/**
 * The deterministic half of ParentPilot, checked without a network call.
 *
 *   npm run check
 *
 * Everything here runs in-process: arithmetic verification, misconception
 * detection, the Live Mode rule engine, the SVG sanitiser, EXIF stripping,
 * the em-dash ban, and the integrity of the three hand-written seed files.
 *
 * Deliberately covers the parts of the product that must not depend on a
 * model being available or being in a good mood. The model-dependent paths
 * (extraction quality, packet prose) are judged by the evaluation set in
 * README.md, which needs a key and a human reading the output.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { copy, sanitize, sanitizeDeep } from "../lib/copy";
import { autonomyScore, countMoves } from "../lib/autonomy";
import { detectors } from "../lib/misconception";
import { evaluateMove, initialLiveState, LIVE_RULES } from "../lib/live/rules";
import { computeAnswer, verifyAnswer } from "../lib/verify";
import { sanitizeSvg } from "../lib/svg";
import { stripMetadata } from "../lib/exif";
import { packetCacheKey } from "../lib/packet";
import { currentProblem, revealsAnswer, threadTitle, threadTranscript } from "../lib/thread";
import { resolveAppUrl } from "../lib/app-url";
import type { MoveLabelName } from "../lib/ai/schemas";

let failures = 0;
let checks = 0;

function section(name: string): void {
  console.log(`\n${name}`);
}

function ok(name: string, condition: boolean): void {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${name}`);
  } else {
    console.log(`  ok    ${name}`);
  }
}

function eq<T>(name: string, actual: T, expected: T): void {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    ok(`${name}  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`, false);
  } else {
    ok(name, true);
  }
}

function listFiles(dir: string, match: RegExp): string[] {
  const root = path.join(process.cwd(), dir);
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const entry of readdirSync(at)) {
      const full = path.join(at, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (match.test(entry)) out.push(full);
    }
  };
  walk(root);
  return out;
}

function readSeed<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), "seed", name), "utf8")) as T;
}

// ---------------------------------------------------------------------------

section("Arithmetic, recomputed in process with exact fractions");

const computeCases: [string, string | null][] = [
  ["1/4 + 2/3 =", "11/12"],
  ["3. 2/5 + 1/5 =", "3/5"],
  ["0.3 + 0.45 =", "0.75"],
  ["0.1 + 0.2", "0.3"], // exact, not 0.30000000000000004
  ["124 ÷ 4 =", "31"],
  ["7 × 8 =", "56"],
  ["12 x 3", "36"],
  ["1 1/2 + 2 1/4 =", "15/4"],
  ["20% of 60 =", "12"],
  ["3/4 × 2/5", "3/10"],
  ["Sarah has 12 apples and gives 5 away. How many are left?", null],
  ["2x + 3 = 11", null],
];
for (const [input, expected] of computeCases) eq(`computeAnswer ${JSON.stringify(input)}`, computeAnswer(input), expected);

const verifyCases: [string, string | null, string][] = [
  ["1/4 + 2/3 =", "11/12", "checked"],
  ["1/4 + 2/3 =", "The answer is 11/12.", "checked"],
  ["1/4 + 2/3 =", "11/12, which is just under 1", "checked"],
  ["1/4 + 2/3 =", "3/7", "unverified"],
  ["1/4 + 2/3 =", null, "unverified"],
  ["1/3 + 1/3 =", "0.67", "checked"], // a legitimate rounding
  ["1/3 + 1/3 =", "0.5", "unverified"],
  ["Sarah has 12 apples and gives 5 away.", "7 apples", "not-applicable"],
];
for (const [problem, claimed, expected] of verifyCases) {
  eq(`verifyAnswer ${JSON.stringify(problem)} vs ${JSON.stringify(claimed)}`, verifyAnswer(problem, claimed).status, expected);
}

// ---------------------------------------------------------------------------

section("Misconception detection, in code rather than by a model");

eq("whole number bias on 1/4 + 2/3 = 3/7",
  detectors.detectWholeNumberBias("1/4 + 2/3 =", "1+2=3, 4+3=7\n3/7"), "whole-number-bias-fraction-addition");
eq("silent when the working is correct",
  detectors.detectWholeNumberBias("1/4 + 2/3 =", "11/12"), null);
eq("fires on the classic 1/2 + 1/2 = 2/4",
  detectors.detectWholeNumberBias("1/2 + 1/2 =", "2/4"), "whole-number-bias-fraction-addition");
eq("silent when componentwise coincides with the correct answer",
  detectors.detectWholeNumberBias("0/3 + 0/4 =", "0/7"), null);
eq("smaller from larger on 43 - 27 = 24",
  detectors.detectSmallerFromLarger("43 - 27 =", "24"), "smaller-from-larger-subtraction");
eq("silent when the subtraction is right",
  detectors.detectSmallerFromLarger("43 - 27 =", "16"), null);
eq("left to right on 2 + 3 x 4 = 20",
  detectors.detectLeftToRight("2 + 3 x 4 =", "5 x 4 = 20"), "left-to-right-order-of-operations");
eq("silent when precedence was applied",
  detectors.detectLeftToRight("2 + 3 x 4 =", "14"), null);
eq("silent when both orders agree",
  detectors.detectLeftToRight("2 x 3 x 4 =", "24"), null);

// ---------------------------------------------------------------------------

section("Live Mode rule engine");

{
  let state = initialLiveState();
  const first = evaluateMove({ label: "ANXIETY_STATEMENT", confidence: 0.9, tOffset: 10, anxietyBand: 2, state });
  ok("an anxiety statement raises a card", first.card?.triggerLabel === "ANXIETY_STATEMENT");
  ok("the card text is the specified line", first.card?.text.startsWith("That sentence is the one thing") === true);

  state = first.state;
  ok("a second card inside the 90s cooldown is suppressed",
    evaluateMove({ label: "GENERIC_PRAISE", confidence: 0.95, tOffset: 40, anxietyBand: 2, state }).card === null);
  ok("a card is allowed once the cooldown elapses",
    evaluateMove({ label: "GENERIC_PRAISE", confidence: 0.95, tOffset: 10 + LIVE_RULES.cooldownSeconds, anxietyBand: 2, state }).card !== null);

  state = initialLiveState();
  let t = 0;
  for (let i = 0; i < 5; i += 1) {
    t += 100;
    state = evaluateMove({ label: "GENERIC_PRAISE", confidence: 0.95, tOffset: t, anxietyBand: 2, state }).state;
  }
  eq("hard cap of three cards per session", state.cardsShown, LIVE_RULES.maxCardsPerSession);

  state = initialLiveState();
  const given = evaluateMove({ label: "GIVES_ANSWER", confidence: 0.99, tOffset: 30, anxietyBand: 2, state });
  ok("giving the answer is logged silently, never a card", given.card === null && given.park === null);

  ok("band 2 suppresses a 0.6 confidence label",
    evaluateMove({ label: "TAKES_OVER", confidence: 0.6, tOffset: 30, anxietyBand: 2, state: initialLiveState() }).card === null);
  ok("band 4 surfaces the same 0.6 confidence label",
    evaluateMove({ label: "TAKES_OVER", confidence: 0.6, tOffset: 30, anxietyBand: 4, state: initialLiveState() }).card !== null);

  let park = initialLiveState();
  park = evaluateMove({ label: "ESCALATION", confidence: 0.9, tOffset: 100, anxietyBand: 2, state: park }).state;
  ok("two escalations inside three minutes parks the session",
    evaluateMove({ label: "ESCALATION", confidence: 0.9, tOffset: 200, anxietyBand: 2, state: park }).park?.reason === "escalation");

  let spread = initialLiveState();
  spread = evaluateMove({ label: "ESCALATION", confidence: 0.9, tOffset: 100, anxietyBand: 2, state: spread }).state;
  ok("escalations outside the window do not park",
    evaluateMove({ label: "ESCALATION", confidence: 0.9, tOffset: 400, anxietyBand: 2, state: spread }).park === null);

  ok("twenty minutes on one problem parks the session",
    evaluateMove({ label: "NEUTRAL", confidence: 0.9, tOffset: LIVE_RULES.parkAfterSeconds, anxietyBand: 2, state: initialLiveState() }).park?.reason === "time");
}

section("Autonomy ratio");
{
  const labels: MoveLabelName[] = [
    "PROBING_QUESTION", "PROBING_QUESTION", "SPECIFIC_PRAISE", "PRODUCTIVE_WAIT",
    "GIVES_ANSWER", "GENERIC_PRAISE",
  ];
  ok("(2 + 1 + 1) / (1 + 1 + 0 + 0 + 1) = 1.333", Math.abs(autonomyScore(countMoves(labels)) - 4 / 3) < 1e-9);
  eq("no directive moves still gives a finite number", autonomyScore(countMoves(["PROBING_QUESTION"])), 1);
  eq("an empty session gives zero", autonomyScore(countMoves([])), 0);
}

// ---------------------------------------------------------------------------

section("Em-dash ban, enforced in code and not only in the prompts");

eq("spaced em dash becomes a comma", sanitize("this one, tricky — let us try"), "this one, tricky, let us try");
eq("unspaced em dash becomes a comma", sanitize("a—b"), "a, b");
eq("trailing em dash becomes a full stop", sanitize("wait for it —"), "wait for it.");
eq("spaced en dash used as an em dash is caught", sanitize("one – two"), "one, two");
eq("a numeric range is left alone", sanitize("grades 3-6"), "grades 3-6");
ok("model output is cleaned recursively",
  JSON.stringify(sanitizeDeep({ a: "x — y", b: ["p — q"] })) === JSON.stringify({ a: "x, y", b: ["p, q"] }));

// ---------------------------------------------------------------------------

section("SVG sanitiser, because Method Match diagrams are model-written markup");

ok("rejects a script tag", sanitizeSvg('<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>') === null);
ok("rejects an inline event handler", sanitizeSvg('<svg viewBox="0 0 10 10"><rect onload="x()" width="5" height="5"/></svg>') === null);
ok("rejects foreignObject", sanitizeSvg('<svg viewBox="0 0 10 10"><foreignObject><b>x</b></foreignObject></svg>') === null);
ok("rejects a gradient", sanitizeSvg('<svg viewBox="0 0 10 10"><linearGradient id="g"/></svg>') === null);
ok("rejects an external image", sanitizeSvg('<svg viewBox="0 0 10 10"><image href="http://x/y.png"/></svg>') === null);
ok("rejects non-svg input", sanitizeSvg("<div>hi</div>") === null);
{
  const rounded = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" rx="3" fill="currentColor"/></svg>');
  ok("strips a rounded corner", rounded !== null && !rounded.includes("rx="));
  ok("keeps currentColor", rounded !== null && rounded.includes('fill="currentColor"'));

  const token = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="var(--annotation)"/></svg>');
  ok("keeps an allowed semantic token", token !== null && token.includes("var(--annotation)"));

  const unknownToken = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="var(--not-a-token)"/></svg>');
  ok("strips an unknown token", unknownToken !== null && !unknownToken.includes("--not-a-token"));

  // A hex paints identically in both themes. #14201E on the dark sheet is
  // 1.1 to 1, which is invisible, so hex is rejected even from the brand
  // palette rather than trusted to be the right value.
  const brandHex = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="#00A878"/></svg>');
  ok("strips a brand hex, because a hex cannot follow the theme",
    brandHex !== null && !brandHex.includes("#00A878"));
  const off = sanitizeSvg('<svg viewBox="0 0 10 10"><rect width="5" height="5" fill="#ff00ff"/></svg>');
  ok("strips an off-palette hex", off !== null && !off.includes("ff00ff"));
}

// ---------------------------------------------------------------------------

section("EXIF stripping, so a worksheet photo does not carry a home address");

{
  const exif = [...Buffer.from("Exif\0\0GPSLatitude 51.5074 GPSLongitude -0.1278")];
  const jpeg = Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1, ((exif.length + 2) >> 8) & 0xff, (exif.length + 2) & 0xff, ...exif,
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0x11, 0x22, 0x33, 0xff, 0xd9,
  ]);
  const stripped = stripMetadata(jpeg);
  const text = Buffer.from(stripped).toString("latin1");
  ok("GPS coordinates are removed", !text.includes("GPSLatitude"));
  ok("the image itself survives", text.includes("\x11\x22\x33") && stripped[0] === 0xff && stripped[1] === 0xd8);

  const chunk = (type: string, data: number[]): number[] => [
    (data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255,
    ...Buffer.from(type), ...data, 0, 0, 0, 0,
  ];
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...chunk("tEXt", [...Buffer.from("Comment\0taken at home")]),
    ...chunk("IEND", []),
  ]);
  const pngText = Buffer.from(stripMetadata(png)).toString("latin1");
  ok("PNG text chunks are removed", !pngText.includes("taken at home"));
  ok("PNG image chunks survive", pngText.includes("IHDR") && pngText.includes("IEND"));
}

// ---------------------------------------------------------------------------

section("Packet cache key");
{
  const a = packetCacheKey("CCSS.MATH.5.NF.A.1", "STANDARD", "en", "1/4 + 2/3 =");
  const b = packetCacheKey("CCSS.MATH.5.NF.A.1", "STANDARD", "en", "1/4  +  2/3  =");
  const c = packetCacheKey("CCSS.MATH.5.NF.A.1", "STANDARD", "en", "3/8 + 1/2 =");
  ok("whitespace differences still hit the same cache entry", a === b);
  ok("a different problem on the same standard does not reuse the answer", a !== c);
  ok("register is part of the key", a !== packetCacheKey("CCSS.MATH.5.NF.A.1", "PLAIN", "en", "1/4 + 2/3 ="));
  ok("language is part of the key", a !== packetCacheKey("CCSS.MATH.5.NF.A.1", "STANDARD", "es", "1/4 + 2/3 ="));
}

// ---------------------------------------------------------------------------

section("App URL resolution, which failed the production build when it was ??");

{
  /**
   * Runs `body` with exactly the given app-url variables set and every other
   * one unset, then puts the environment back however it found it. Saving and
   * restoring keeps these cases order-independent and stops them leaking into
   * the rest of the suite.
   */
  const withEnv = (
    vars: { appUrl?: string; productionUrl?: string; deploymentUrl?: string },
    body: (resolved: string) => void,
  ): void => {
    const keys = ["NEXT_PUBLIC_APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
    const saved = keys.map((key) => [key, process.env[key]] as const);

    try {
      for (const key of keys) delete process.env[key];
      if (vars.appUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = vars.appUrl;
      if (vars.productionUrl !== undefined) process.env.VERCEL_PROJECT_PRODUCTION_URL = vars.productionUrl;
      if (vars.deploymentUrl !== undefined) process.env.VERCEL_URL = vars.deploymentUrl;

      // The production invariant: this is called at module scope in
      // app/layout.tsx, so a throw here is a failed build, not a failed request.
      let resolved: string;
      try {
        resolved = resolveAppUrl();
      } catch {
        ok("resolveAppUrl threw, which would fail the build", false);
        return;
      }
      body(resolved);
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };

  /** Every return value must be something `new URL()` accepts. */
  const constructible = (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  // The actual production bug: defined, but empty. `??` does not substitute
  // here, so the old code handed `new URL("")` an empty string and the build
  // died on /_not-found.
  withEnv({ appUrl: "" }, (resolved) => {
    eq("an empty NEXT_PUBLIC_APP_URL falls through to localhost", resolved, "http://localhost:3000");
    ok("  and the result is constructible", constructible(resolved));
  });

  withEnv({ appUrl: "   " }, (resolved) => {
    eq("a whitespace-only value falls through", resolved, "http://localhost:3000");
  });

  withEnv({}, (resolved) => {
    eq("an undefined value falls through", resolved, "http://localhost:3000");
  });

  withEnv({ appUrl: "not-a-url" }, (resolved) => {
    eq("a malformed value falls through rather than killing the build", resolved, "http://localhost:3000");
    ok("  and the result is constructible", constructible(resolved));
  });

  withEnv({ appUrl: "https://parentpilot.app/" }, (resolved) => {
    eq("a trailing slash is stripped", resolved, "https://parentpilot.app");
  });

  withEnv({ appUrl: "https://parentpilot.app/app/" }, (resolved) => {
    eq("a trailing slash is stripped from a path too", resolved, "https://parentpilot.app/app");
  });

  // Vercel sets these two automatically, and neither carries a protocol.
  withEnv({ productionUrl: "parentpilot.vercel.app" }, (resolved) => {
    eq("a bare production host gains https", resolved, "https://parentpilot.vercel.app");
  });

  withEnv({ deploymentUrl: "parentpilot-abc123.vercel.app" }, (resolved) => {
    eq("a bare deployment host gains https", resolved, "https://parentpilot-abc123.vercel.app");
  });

  // Precedence, including the empty-but-defined case Vercel actually produces.
  withEnv({ appUrl: "", productionUrl: "prod.vercel.app", deploymentUrl: "dep.vercel.app" }, (resolved) => {
    eq("an empty explicit value defers to the production host", resolved, "https://prod.vercel.app");
  });

  withEnv({ appUrl: "https://chosen.example", productionUrl: "prod.vercel.app" }, (resolved) => {
    eq("an explicit value wins over the production host", resolved, "https://chosen.example");
  });

  withEnv({ productionUrl: "", deploymentUrl: "dep.vercel.app" }, (resolved) => {
    eq("an empty production host defers to the deployment host", resolved, "https://dep.vercel.app");
  });

  // Values that parse as a URL but are useless as a site origin.
  withEnv({ appUrl: "mailto:hi@parentpilot.app" }, (resolved) => {
    eq("a non-http protocol falls through", resolved, "http://localhost:3000");
  });

  withEnv({ appUrl: "https://already.example", productionUrl: "https://schemed.example" }, (resolved) => {
    ok("a host that already has a protocol is not double-prefixed", !resolved.includes("https://https://"));
  });

  withEnv({ productionUrl: "https://schemed.example" }, (resolved) => {
    eq("  and is used as it stands", resolved, "https://schemed.example");
  });
}

// ---------------------------------------------------------------------------

section("Colour contrast, computed from the tokens rather than asserted");

{
  /**
   * Parses one custom-property block out of globals.css.
   *
   * The design plan carries a contrast table. A table in a document goes stale
   * the first time someone nudges a token; these assertions do not, because
   * they read the same file the browser reads.
   */
  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

  const readTokens = (selector: string): Record<string, string> => {
    const start = css.indexOf(selector);
    if (start === -1) return {};
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    const body = css.slice(open + 1, close);
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|var\([^)]*\))\s*;/g)) {
      const [, name, value] = m;
      if (name && value) out[name] = value.trim();
    }
    return out;
  };

  /**
   * Follows `--ink: var(--text-on-sheet)` through to a literal.
   *
   * The legacy tokens are aliases now. Reading them without resolving would
   * silently skip exactly the ones that were broken: --ink rendered at
   * 1.10 to 1 in dark mode and no assertion noticed, because the parser only
   * looked at literal hex.
   */
  const resolve = (tokens: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(tokens)) {
      let value = tokens[key] ?? "";
      for (let hop = 0; hop < 8 && value.startsWith("var("); hop += 1) {
        const ref = value.match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
        if (!ref) break;
        value = tokens[ref] ?? "";
      }
      if (value.startsWith("#")) out[key] = value;
    }
    return out;
  };

  const lightRaw = readTokens(":root {");
  const darkRaw = { ...lightRaw, ...readTokens(':root[data-theme="dark"] {') };
  const light = resolve(lightRaw);
  const dark = resolve(darkRaw);

  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const luminance = (hex: string): number => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const contrast = (a: string, b: string): number => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  /** [foreground token, background token, minimum ratio, what it is] */
  const pairs: [string, string, number, string][] = [
    // 4.5 is AA for body text. 3.0 is AA for non-text, which is what a pen
    // mark circling a wrong digit is.
    ["--text-on-frame", "--surface-frame", 4.5, "text on the teal desk"],
    ["--text-on-frame", "--surface-frame-deep", 4.5, "text on the header and footer"],
    ["--text-on-frame-muted", "--surface-frame", 4.5, "muted text on the desk"],
    ["--text-on-sheet", "--surface-sheet", 4.5, "text on paper"],
    ["--text-on-sheet-muted", "--surface-sheet", 4.5, "muted text on paper"],
    ["--annotation", "--surface-sheet", 3.0, "the pen mark on paper"],
    ["--annotation-on-frame", "--surface-frame", 3.0, "the pen mark on the desk"],
    ["--pencil", "--surface-sheet", 4.5, "the child's handwriting on paper"],
    ["--alert-fg", "--surface-sheet", 4.5, "alert text on paper"],

    // The legacy aliases. Most of the app still asks for these by name, so
    // they are assertable surface, not internal detail. Before they became
    // aliases, --ink on the dark sheet was 1.10 to 1.
    ["--ink", "--paper", 4.5, "legacy --ink on legacy --paper"],
    ["--muted", "--paper", 4.5, "legacy --muted on legacy --paper"],
    ["--teal", "--paper", 4.5, "legacy --teal, used for headings and badges"],
    ["--emerald", "--paper", 3.0, "legacy --emerald, used for marks and fills"],
    ["--alert", "--paper", 4.5, "legacy --alert"],
    // A divider hairline is decorative and carries no meaning, so it has no
    // contrast floor. The boundary of an interactive control does, under WCAG
    // 1.4.11, and it used to share the divider token at 1.33 to 1 on paper.
    ["--border-interactive", "--surface-sheet", 3.0, "input and button borders on paper"],
    ["--border-interactive-frame", "--surface-frame", 3.0, "control borders on the desk"],
    ["--border-interactive-frame", "--surface-frame-deep", 3.0, "control borders in the header"],
    // The selected segment of the register control is text on the annotation
    // fill, which is a primary control and easy to miss when only surfaces
    // are checked.
    ["--paper", "--annotation", 4.5, "label on a selected control"],
    // The third voice. A filled action with its own label colour.
    ["--action-label", "--action", 4.5, "label on a primary action"],
    ["--action", "--surface-sheet", 4.5, "an outlined action on paper"],

    /* The /app layer. It is a separate palette on a separate surface, so
       nothing above covers it: every one of these was unasserted when the
       chat shell was first written. */
    ["--app-text", "--app-bg", 4.5, "thread text"],
    ["--app-text-dim", "--app-bg", 4.5, "dim thread text"],
    ["--app-text", "--app-card", 4.5, "text on a card"],
    ["--app-text-dim", "--app-card", 4.5, "dim text on a card"],
    ["--app-text", "--app-rail", 4.5, "text in the sidebar"],
    ["--app-text-dim", "--app-rail", 4.5, "dim text in the sidebar"],
    ["--app-text", "--app-bubble", 4.5, "the parent's own words"],
    ["--accent-ink", "--app-card", 4.5, "the accent as text on a card"],
    ["--accent-ink", "--app-bg", 4.5, "the accent as text in the thread"],
    ["--app-alert-ink", "--app-alert-bg", 4.5, "the degradation notice"],
    // 1.4.11: a control identified by its border needs 3:1, and the app
    // hairline is 1.2:1. The composer and the outline buttons use this one.
    ["--app-border-interactive", "--app-bg", 3.0, "app control borders"],
    ["--app-border-interactive", "--app-card", 3.0, "app control borders on a card"],
  ];

  for (const [mode, tokens] of [["light", light], ["dark", dark]] as const) {
    for (const [fg, bg, min, label] of pairs) {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      if (!fgValue || !bgValue) {
        ok(`${mode}: ${fg} and ${bg} are both defined`, false);
        continue;
      }
      const ratio = contrast(fgValue, bgValue);
      ok(
        `${mode}: ${label} is at least ${min.toFixed(1)} to 1  (${ratio.toFixed(2)})`,
        ratio >= min,
      );
    }
  }

  // The pen is emerald, but brand emerald on paper measures 2.71 and fails
  // even the non-text threshold, so the on-paper variant must be darker.
  ok("the on-paper pen is darker than brand emerald, because #00A878 on paper is 2.71",
    (light["--annotation"] ?? "").toLowerCase() !== "#00a878");

  /* ---- The Part B invariant -------------------------------------------

     Dark mode is the same scene at night, not an inversion. The room goes
     unlit and the paper stays paper, dimmed. The first attempt made the sheet
     #132A25 against a #0A1614 desk: two dark greens close in value, so the
     paper stopped reading as paper and the child's pencil working read as
     chalk on a blackboard, which inverts whose surface it is. */
  const lighter = (a: string | undefined, b: string | undefined): boolean =>
    luminance(a ?? "#000000") > luminance(b ?? "#ffffff");

  for (const [mode, tokens] of [["light", light], ["dark", dark]] as const) {
    ok(`${mode}: the sheet is lighter than the desk, so paper reads as paper`,
      lighter(tokens["--surface-sheet"], tokens["--surface-frame"]));
    ok(`${mode}: ink is darker than the sheet it is written on`,
      lighter(tokens["--surface-sheet"], tokens["--text-on-sheet"]));
    ok(`${mode}: rules on paper are darker than the paper`,
      lighter(tokens["--surface-sheet"], tokens["--rule-on-sheet"]));
    ok(`${mode}: rules on the desk are lighter than the desk`,
      lighter(tokens["--rule-on-frame"], tokens["--surface-frame"]));
  }

  // The dimmed sheet must genuinely be dimmer, or dark mode emits as much
  // light as day mode and the setting is cosmetic.
  const dayPaper = luminance(light["--surface-sheet"] ?? "#ffffff");
  const nightPaper = luminance(dark["--surface-sheet"] ?? "#ffffff");
  ok(`the night sheet is dimmed, not merely tinted  (${((nightPaper / dayPaper) * 100).toFixed(0)}% of daytime luminance)`,
    nightPaper < dayPaper * 0.9);

  /* Because the sheet stays paper, everything written on it is unchanged
     between modes. That is the economy the design buys: a designed variant
     needs fewer overrides than a darkened copy, not more. */
  for (const token of ["--text-on-sheet", "--pencil", "--annotation", "--accent-on-sheet"]) {
    ok(`${token} is one value in both modes`,
      (light[token] ?? "L").toLowerCase() === (dark[token] ?? "D").toLowerCase());
  }
}

// ---------------------------------------------------------------------------

section("Redesign direction holds");

{
  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const landing = readFileSync(path.join(process.cwd(), "app", "(site)", "page.tsx"), "utf8");
  const layout = readFileSync(path.join(process.cwd(), "app", "layout.tsx"), "utf8");
  const icons = readFileSync(path.join(process.cwd(), "components", "icons.tsx"), "utf8");

  ok("body face is Public Sans", /--font-sans:\s*"Public Sans"/.test(css));
  ok("IBM Plex Sans is gone", !/IBM Plex/.test(css) && !/IBM\+Plex/.test(layout));
  ok("Fraunces is still the display face", /--font-display:\s*"Fraunces"/.test(css));
  ok("dark mode is a designed variant, not an inversion",
    css.includes('[data-theme="dark"]') && css.includes("prefers-color-scheme: dark"));
  ok("the theme choice is applied before first paint", layout.includes("pp_theme"));

  // Two additions to the ban list, scoped to the landing page.
  ok("no tracked-out all-caps eyebrow on the landing page",
    !/textTransform:\s*"uppercase"/.test(landing));
  // A headline with one word in a different colour is the other addition. The
  // headline must be a single expression, not a sentence broken up by spans.
  const headline = landing.match(/<h1[^>]*>\s*\{([^}]*)\}\s*<\/h1>/);
  ok("the headline is one string, with no single accented word",
    headline !== null && !headline[1]?.includes("<"));

  // The hero shows the product rather than a picture of a screen.
  ok("the hero renders the real fixture, not marketing copy", landing.includes("demoBundle"));
  ok("no device or browser chrome around the artifact",
    !/browser|laptop|deviceFrame|macbook/i.test(landing));

  // The four-point diamond is the brand mark. At 16px it is also the AI
  // sparkle cliché, so it appears in the compass icon and nowhere else.
  const diamondUses = icons.split("d={DIAMOND}").length - 1;
  ok(`the compass diamond is used once, in the compass icon only (${diamondUses})`, diamondUses === 1);
  ok("no icon library", !/lucide|heroicons|phosphor|react-icons/i.test(icons));
  ok("icons are a 24px grid at 1.5px", icons.includes('viewBox="0 0 24 24"') && icons.includes("strokeWidth={1.5}"));
}

// ---------------------------------------------------------------------------

section("No literal colour inside any seeded or generated markup");

{
  /**
   * A hex inside an SVG paints identically in both themes. `#14201E` on the
   * dark sheet is 1.1 to 1, which is invisible, and every diagram in the seed
   * files carried one. The rule is enforced in three places so it cannot come
   * back: here, in the sanitiser, and in the packet prompt.
   */
  const HEX = /#[0-9a-fA-F]{3,8}\b/;
  const MARKUP_FIELDS = new Set(["visualSvg", "svg"]);

  const findHex = (node: unknown, at: string, into: string[]): void => {
    if (typeof node === "string") {
      if (node.includes("<svg") && HEX.test(node)) {
        into.push(`${at}: ${node.match(HEX)?.[0] ?? ""}`);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => findHex(v, `${at}[${i}]`, into));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        // Markup fields are checked whether or not they announce themselves,
        // and every other string is checked for embedded markup too.
        if (MARKUP_FIELDS.has(k) && typeof v === "string" && HEX.test(v)) {
          into.push(`${at}.${k}: ${v.match(HEX)?.[0] ?? ""}`);
        } else {
          findHex(v, `${at}.${k}`, into);
        }
      }
    }
  };

  for (const file of ["standards.json", "misconceptions.json", "demo-packet.json"]) {
    const found: string[] = [];
    findHex(readSeed<unknown>(file), file, found);
    ok(`${file} contains no literal hex inside markup${found.length ? `  (${found.join(", ")})` : ""}`,
      found.length === 0);
  }

  // Every diagram in the seed must still survive the sanitiser, which now
  // rejects hex. A stripped fill is a missing shape, not a wrong colour.
  interface WithSvg { id: string; visualSvg: string | null }
  const misconceptions = readSeed<WithSvg[]>("misconceptions.json");
  for (const m of misconceptions) {
    if (!m.visualSvg) continue;
    const clean = sanitizeSvg(m.visualSvg);
    ok(`${m.id}: diagram survives the sanitiser`, clean !== null);
    ok(`${m.id}: diagram inherits colour rather than naming one`,
      clean !== null && (clean.includes("currentColor") || clean.includes("var(--")));
  }

  const demoPackets = readSeed<{ packets: Record<string, { methodMatch: { schoolMethod: { svg: string } } }> }>(
    "demo-packet.json",
  ).packets;
  for (const [register, packet] of Object.entries(demoPackets)) {
    const clean = sanitizeSvg(packet.methodMatch.schoolMethod.svg);
    ok(`demo ${register}: Method Match diagram survives and follows the theme`,
      clean !== null && (clean.includes("currentColor") || clean.includes("var(--")));
  }

  // The wrapper has to set a colour, or currentColor resolves to whatever it
  // inherits and the rule achieves nothing.
  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  ok("the diagram wrapper sets a colour for currentColor to resolve against",
    /\.pp-diagram\s*\{[^}]*color:\s*var\(--text-on-sheet\)/.test(css));

  // And the prompt states the rule, or every future generated diagram
  // reintroduces the bug.
  const packetPrompt = readFileSync(path.join(process.cwd(), "prompts", "generate-packet.md"), "utf8");
  const flat = packetPrompt.replace(/\s+/g, " ");
  ok("the packet prompt forbids hex inside an SVG", /never emit a hex colour/i.test(flat));
  ok("the packet prompt names currentColor", flat.includes("currentColor"));
  ok("the packet prompt names the semantic tokens", flat.includes("var(--annotation)"));
  ok("the packet prompt no longer instructs a hex palette", !/#14201E.*for lines and text/i.test(flat));
}

// ---------------------------------------------------------------------------

section("The problem screen is one question, not an essay");

{
  const screen = readFileSync(path.join(process.cwd(), "components", "PacketScreen.tsx"), "utf8");
  const disclosure = readFileSync(path.join(process.cwd(), "components", "Disclosure.tsx"), "utf8");

  // Everything that used to open the screen is now behind a closed control.
  for (const key of ["discloseWhy", "discloseMethods", "discloseTeaching", "discloseScripts", "discloseAnswer"] as const) {
    ok(`${key} is rendered as a disclosure`, screen.includes(`copy.packet.${key}`));
  }

  // Closed by default, and never opened by an attribute.
  ok("disclosures are built on <details> and are closed by default",
    disclosure.includes("<details") && !/\bopen\b\s*[=>]/.test(disclosure));

  // The answer is the escape hatch, so it is the last thing on the screen.
  const order = ["discloseWhy", "discloseMethods", "discloseTeaching", "discloseScripts", "discloseAnswer"]
    .map((k) => screen.indexOf(`copy.packet.${k}`));
  ok("the answer disclosure is last, furthest from the thumb",
    order.every((pos, i) => i === 0 || pos > (order[i - 1] ?? -1)));

  // One primary action. "Still stuck" continues the flow and is filled;
  // "She answered it" is the quiet end of the task.
  ok("Still stuck is the primary action", screen.includes("copy.packet.stillStuck"));
  ok("She answered it is present but secondary", screen.includes("copy.packet.answeredIt"));
  ok("the ladder advances one rung at a time, never as a list",
    screen.includes("Math.min(n + 1, rungs.length - 1)"));

  // The primer no longer opens the screen, and is truncated by default.
  ok("the primer is cut to its opening sentences by default",
    screen.includes("primerOpening") && screen.includes("copy.packet.primerMore"));

  // Isomorphs belong to the solved state, where their own copy says they do.
  const solvedAt = screen.indexOf("copy.packet.solvedHeading");
  const isomorphAt = screen.indexOf("packet.isomorphs");
  ok("the isomorphs sit on the solved path, not the stuck path",
    solvedAt !== -1 && isomorphAt > solvedAt);

  // The component the ladder replaced is gone rather than orphaned.
  ok("the old list-style hint ladder component is removed",
    !existsSync(path.join(process.cwd(), "components", "HintLadder.tsx")));
}

// ---------------------------------------------------------------------------

section("The third voice: actions and annotations are different colours");

{
  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const componentFiles = listFiles("components", /\.tsx$/).concat(listFiles("app", /\.tsx$/));
  const components = componentFiles.map((f) => readFileSync(f, "utf8")).join("\n");

  ok("an action colour exists, separate from the pen", css.includes("--action:"));
  ok("it has its own label colour", css.includes("--action-label:"));

  /* Emerald is the pen: the marks a teacher makes on a page. Round two said
     explicitly that it is not a button fill everywhere, and Part D had
     regressed to filling the primary button with it, so one colour meant both
     "this is the error" and "press this". */
  const penAsFill = [
    /background:\s*"var\(--emerald\)"/,
    /background:\s*"var\(--annotation\)"/,
    /background:\s*[^,;]*\?\s*"var\(--emerald\)"/,
    /background:\s*[^,;]*\?\s*"var\(--annotation\)"/,
  ];
  for (const pattern of penAsFill) {
    const hit = components.match(pattern);
    ok(`the pen is never a button fill${hit ? `  (found ${JSON.stringify(hit[0])})` : ""}`, hit === null);
  }

  ok("the primary button uses the action colour", components.includes('background: "var(--action)"'));
  // The pen still marks things: the hero ring, the error label, the doctor.
  ok("the pen still marks the page", components.includes("var(--annotation)"));
}

// ---------------------------------------------------------------------------

section("Accounts are parent accounts, and the session is not a bearer id");

{
  const auth = readFileSync(path.join(process.cwd(), "lib", "auth.ts"), "utf8");
  const session = readFileSync(path.join(process.cwd(), "lib", "session.ts"), "utf8");
  const email = readFileSync(path.join(process.cwd(), "lib", "email.ts"), "utf8");

  /* The no-child-account invariant, at the one place it could plausibly be
     broken. The auth module reads and writes Parent and nothing else; there is
     no Child table access in it at all, so there is no code path that could
     mint a credential for a child. */
  ok("the auth module never touches the Child table",
    !/prisma\.child\b/i.test(auth));
  ok("the auth module has no notion of a child at all",
    !/\bchild\b/i.test(auth.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ")));

  // The cookie used to hold a bare Parent.id. A cuid embeds a timestamp and a
  // counter rather than being random, so once an id carries an identity an
  // unsigned cookie is account takeover for anyone who can guess one.
  ok("the session cookie is signed", auth.includes("createHmac") && auth.includes("sealSession"));
  /* A production deployment signing with a value published in this repository
     has forgeable cookies for anyone who has read the source. Failing closed
     turns a silent vulnerability into a visible outage. */
  ok("a missing AUTH_SECRET fails closed in production rather than falling back",
    /NODE_ENV === "production"[\s\S]{0,200}throw new Error/.test(auth));
  ok("the signature is compared in constant time", auth.includes("timingSafeEqual"));
  ok("the session module seals what it writes", session.includes("sealSession("));
  ok("the session module verifies what it reads", session.includes("openSession("));
  ok("a bare parent id is never written to the cookie",
    !/store\.set\(COOKIE,\s*parent\.id/.test(session));

  // A leaked database should hand over hashes, not live sign-in links.
  ok("the link token is hashed before storage", auth.includes("createHash") && auth.includes("tokenHash"));
  ok("the raw token is generated from a CSPRNG", auth.includes("randomBytes"));
  ok("links expire", auth.includes("expiresAt"));
  ok("links are single use", auth.includes("usedAt"));
  ok("asking again retires the previous link", auth.includes("updateMany"));

  // A sign-in link rendered in a page would let a visitor sign in as any
  // address they can type.
  ok("an undeliverable link goes to the server log, never to the browser",
    email.includes("console.warn") && !/return[^;]*\burl\b/.test(email));
}

// ---------------------------------------------------------------------------

section("Audio primer, Studio panel and citations");

{
  const provider = readFileSync(path.join(process.cwd(), "lib", "ai", "provider.ts"), "utf8");
  const route = readFileSync(path.join(process.cwd(), "app", "api", "audio", "route.ts"), "utf8");
  const studio = readFileSync(path.join(process.cwd(), "components", "StudioPanel.tsx"), "utf8");
  const citation = readFileSync(path.join(process.cwd(), "components", "Citation.tsx"), "utf8");

  ok("the voice is nova", provider.includes('DEFAULT_TTS_VOICE = "nova"'));
  ok("speech goes through the provider like every other model call",
    provider.includes("export async function speakPrimer"));
  ok("and increments the spend ledger", /speakPrimer[\s\S]{0,900}recordSpend/.test(provider));
  ok("the route never calls the SDK itself", !/new OpenAI|openai\.audio/.test(route));

  // Cached on the packet key, so a primer is spoken once per standard,
  // register and language rather than once per listen.
  ok("audio is cached on the packet cache key", route.includes("packetCacheKey("));
  ok("the cache is consulted before generating",
    route.indexOf("audioPrimer.findUnique") < route.indexOf("speakPrimer("));
  ok("the spend ceiling is honoured", route.includes("spendCeilingReached"));
  ok("requests are rate limited", route.includes("consume("));

  /* The Studio panel lists what a session can produce. It stops where the
     product stops: a flashcard or a quiz is an artifact for a learner to study
     from, and this product does not address the learner. */
  for (const refused of ["flashcard", "quiz", "mind map", "slide", "video overview"]) {
    const pattern = new RegExp(refused.replace(" ", "\\s*"), "i");
    const inCode = studio.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    // The panel may name them in the copy that explains their absence, but it
    // must never offer one.
    const offered = new RegExp(`(onClick|href)[^\n]*${refused.split(" ")[0]}`, "i").test(inCode);
    ok(`the Studio panel does not offer ${refused}s`, !offered && pattern.test(studio) === pattern.test(studio));
  }
  ok("the Studio panel offers the teacher note, the share link and the audio primer",
    studio.includes("copy.studio.teacherNote") &&
      studio.includes("copy.studio.shareLink") &&
      studio.includes("copy.studio.audioPrimer"));

  ok("citations expand in place rather than navigating away",
    citation.includes("useState") && !citation.includes("<a "));
}

// ---------------------------------------------------------------------------

section("Seed data");

interface StandardSeed { id: string; code: string; grade: number; plainLanguage: string; expectedMethods: string[]; parentMethod: string }
interface MisconceptionSeed { id: string; standardCode: string; signature: string; plainName: string; repairQuestion: string; visualSvg: string | null }

const standards = readSeed<StandardSeed[]>("standards.json");
const misconceptions = readSeed<MisconceptionSeed[]>("misconceptions.json");
const demo = readSeed<Record<string, unknown>>("demo-packet.json");

ok(`at least 60 standards (have ${standards.length})`, standards.length >= 60);
ok("standards cover grades 3 to 6", [3, 4, 5, 6].every((g) => standards.some((s) => s.grade === g)));
ok("standard codes are unique", new Set(standards.map((s) => s.code)).size === standards.length);
ok("every standard has at least one expected method", standards.every((s) => s.expectedMethods.length > 0));

eq("exactly the 20 documented misconceptions", misconceptions.length, 20);
ok("misconception ids are unique", new Set(misconceptions.map((m) => m.id)).size === 20);
{
  const codes = new Set(standards.map((s) => s.code));
  ok("every misconception points at a standard that exists", misconceptions.every((m) => codes.has(m.standardCode)));
  ok("every misconception diagram survives sanitising",
    misconceptions.filter((m) => m.visualSvg).every((m) => sanitizeSvg(m.visualSvg) !== null));
}

{
  const walk = (node: unknown, at: string): string[] => {
    if (typeof node === "string") return /—|―/.test(node) ? [at] : [];
    if (Array.isArray(node)) return node.flatMap((v, i) => walk(v, `${at}[${i}]`));
    if (node && typeof node === "object") {
      return Object.entries(node).flatMap(([k, v]) => walk(v, `${at}.${k}`));
    }
    return [];
  };
  const leaks = [
    ...walk(standards, "standards"),
    ...walk(misconceptions, "misconceptions"),
    ...walk(demo, "demo"),
  ];
  ok(`no em dash anywhere in the seed data${leaks.length ? ` (found at ${leaks.join(", ")})` : ""}`, leaks.length === 0);
}

{
  const packets = (demo as { packets: Record<string, Record<string, unknown>> }).packets;
  ok("demo fixture carries all three registers, so the landing demo is free",
    ["PLAIN", "STANDARD", "TECHNICAL"].every((r) => Boolean(packets[r])));

  for (const [register, packet] of Object.entries(packets)) {
    const rungs = packet.hintLadder as string[];
    eq(`${register}: exactly five hint rungs`, rungs.length, 5);
    ok(`${register}: every rung is a question`, rungs.every((r) => r.trim().endsWith("?")));
    eq(`${register}: exactly three isomorphs`, (packet.isomorphs as string[]).length, 3);

    // The answer renders behind a press and hold. Every other field renders
    // above it, so a mention anywhere else defeats the lock.
    const rest = Object.fromEntries(Object.entries(packet).filter(([k]) => k !== "lockedAnswer"));
    ok(`${register}: the answer appears nowhere but lockedAnswer`, !JSON.stringify(rest).includes("11/12"));
    ok(`${register}: lockedAnswer actually carries the answer`, String(packet.lockedAnswer).includes("11/12"));
  }
}


// ---------------------------------------------------------------------------

section("The chat surface keeps the promises the old screens made");

{
  const thread = readFileSync(path.join(process.cwd(), "lib", "thread.ts"), "utf8");
  const cards = readFileSync(path.join(process.cwd(), "components", "app", "Cards.tsx"), "utf8");
  const shell = readFileSync(path.join(process.cwd(), "components", "app", "AppShell.tsx"), "utf8");
  const route = readFileSync(
    path.join(process.cwd(), "app", "api", "thread", "turn", "route.ts"), "utf8");

  /* Round three made degradation visible. Rebuilding the surface is exactly
     when that kind of promise gets dropped, so it is asserted here rather
     than trusted: a saved example that renders like a real reading is the
     failure that actually costs a parent something. */
  ok("a packet that did not read this page emits a notice card",
    /if \(bundle\.notice\)[\s\S]{0,80}kind: "notice"/.test(thread));
  ok("the notice card renders", /case "notice":/.test(cards));
  ok("the notice is never collapsed behind a disclosure",
    !/case "notice":[\s\S]{0,400}<Shell/.test(cards));

  // The answer stays behind the press and hold on this surface too.
  ok("the answer card still uses the locked control", /LockedAnswer/.test(cards));
  /* The answer may reach LockedAnswer as a prop and reach nothing else. As a
     JSX child it would render straight into the thread, which is the one
     place the answer must never appear. */
  const answerCase = cards.slice(cards.indexOf('case "answer":'), cards.indexOf('case "live_summary":'));
  const answerUses = [...answerCase.matchAll(/\{card\.answer\}/g)].length;
  const asProp = [...answerCase.matchAll(/answer=\{card\.answer\}/g)].length;
  ok(`the answer is passed to the locked control and nowhere else  (${asProp} of ${answerUses})`,
    answerUses > 0 && answerUses === asProp);
  ok("the answer is never a bare child node",
    !/>\s*\{card\.answer\}/.test(answerCase) && !/\{card\.answer\}\s*</.test(answerCase));

  // The one thing this product does not do.
  ok("the thread never addresses the child",
    !/\byou(r)? child\b(?![^\n]*never)/i.test(cards) || /talks to you, never/.test(cards));

  /* The shell imitates a convention, and the convention is sentence case.
     Tracked-out capitals were the round-two tell and they crept back in via
     the register control and the ask card. */
  for (const [name, source] of [["the cards", cards], ["the shell", shell]] as const) {
    ok(`no all-caps label on ${name}`, !/textTransform:\s*"uppercase"/.test(source));
  }

  // A phone opens the thread, not the drawer over it.
  ok("the sidebar starts closed at drawer widths", /innerWidth\s*<=\s*DRAWER_MAX/.test(shell));
  ok("an open drawer can be dismissed by tapping the thread", /pp-scrim/.test(shell));

  // Advancing the ladder is a lookup, not a generation: the rungs already
  // exist, and a model call here would be spend with nothing bought.
  const advance = route.slice(route.indexOf('case "advance"'));
  ok("Still stuck makes no model call",
    advance.length > 0 && !/generatePacket|complete\(|openai/i.test(advance.slice(0, 900)));
}

// ---------------------------------------------------------------------------

section("Design system, scanned over source with comments stripped");

{
  // Comments state the rules ("Nothing bounces or springs", "never a
  // skeleton"), so scanning raw source produces false positives. Strip them
  // first and scan only code that ships.
  const stripComments = (code: string): string =>
    code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  const files = [
    ...listFiles("app", /\.(tsx|css)$/),
    ...listFiles("components", /\.tsx$/),
  ];
  const source = files.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n");

  /* The revised ban list. Radius, elevation, bento grids, pastels, coloured
     left stripes and skeleton loaders came off it in round three; harshness
     is now a matter of judgement rather than of regex, so what remains here
     is only what a pattern can honestly detect.

     The status line is kept over a skeleton loader by choice, not by ban: it
     is a product decision from the original brief, and a skeleton implies the
     shape of the result is known when a 20 second model call means it is not. */
  const forbidden: [string, RegExp][] = [
    ["radial orbs", /radial-gradient|conic-gradient/],
    ["dot grids", /repeating-(linear|radial)-gradient/],
    ["icon libraries", /lucide|react-icons|@heroicons|phosphor|font-awesome/i],
    /* Round four lifted the ban on Inter, which is now the UI face of /app:
       the chat surface is meant to read as a chat surface, and Inter is what
       that convention is set in. Geist and Space Grotesk stay banned; neither
       was asked for, and both are tells rather than choices. */
    ["the forbidden typefaces", /["'\s](Geist|Space Grotesk)["',]/],
    ["glassmorphism", /backdrop-?[Ff]ilter/],
    ["springy easing", /cubic-bezier\([^)]*\b1\.[1-9]/],
    ["streak counters", /streak/i],
    ["confetti", /confetti/i],
  ];

  for (const [name, pattern] of forbidden) {
    const hit = source.match(pattern);
    ok(`no ${name}${hit ? `  (found ${JSON.stringify(hit[0])})` : ""}`, hit === null);
  }

  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  /* A small radius is allowed now, but only as a signal that something can be
     pressed. The sledgehammer is gone, the scale is capped so nothing can
     reach a pill, and paper opts back out. */
  ok("the global border-radius sledgehammer is gone",
    !/\*\s*\{[^}]*border-radius:\s*0\s*!important/.test(css));

  const radii = [...css.matchAll(/--radius-[\w-]+:\s*(\d+)px;/g)].map((m) => Number(m[1]));
  ok(`no radius token exceeds 4px, so nothing can become a pill  (max ${Math.max(...radii, 0)}px)`,
    radii.length > 0 && radii.every((r) => r <= 4));
  ok("interactive elements carry the control radius",
    /button,\s*\n\s*input,\s*\n\s*select,\s*\n\s*textarea\s*\{[^}]*border-radius:\s*var\(--radius-control\)/.test(css));
  ok("paper opts back out, because paper has square corners",
    /\.pp-sheet-page[\s\S]{0,160}border-radius:\s*0;/.test(css));
  ok("the focus ring follows the radius it sits on rather than being forced square",
    /:focus-visible\s*\{[^}]*border-radius:\s*inherit/.test(css));
  ok("body type is at least 17px", /font-size:\s*17px/.test(css));
  ok("body line height is 1.6", /line-height:\s*1\.6/.test(css));
  ok("reduced motion is honoured", css.includes("prefers-reduced-motion: reduce"));

  /* The radius cap above governs the site surface only. /app has its own
     scale, because a chat composer with a 4px radius does not read as a chat
     composer. Keeping the two scales in separate token families is what stops
     the mainstream radii leaking back onto the paper. */
  const appRadii = [...css.matchAll(/--r-[\w-]+:\s*(\d+)px;/g)].map((m) => Number(m[1]));
  ok(`the app surface has its own radius scale  (${appRadii.length} tokens)`, appRadii.length >= 4);
  ok("the composer is the roundest thing on the app surface",
    /--r-composer:\s*24px/.test(css) && /--r-control:\s*8px/.test(css));
  ok("paper never borrows an app radius",
    !/\.pp-sheet[\w-]*\s*\{[^}]*var\(--r-(control|card|bubble|composer)\)/.test(css));
}

// ---------------------------------------------------------------------------

section("Promises the product makes in its own copy");

ok("the landing page states the audio promise",
  copy.landing.audioPromise.includes("never leaves your device") &&
    copy.landing.audioPromise.includes("never stored"));
ok("the landing page states there is no child account",
  copy.landing.noChild.toLowerCase().includes("no child account"));
ok("GIVES_ANSWER has no card, by design",
  !Object.prototype.hasOwnProperty.call(copy.cards, "GIVES_ANSWER"));
ok("every specified card trigger has its exact text",
  copy.cards.TAKES_OVER === "You've been talking for 40 seconds. Ask something and wait." &&
    copy.cards.ESCALATION === "Take 20 seconds. Get a glass of water. Nothing is lost." &&
    copy.cards.PRODUCTIVE_WAIT === "Let her think. This silence is the work.");

// ---------------------------------------------------------------------------

section("Free text holds the thesis under conversational pressure");

{
  const prompt = readFileSync(path.join(process.cwd(), "prompts", "chat-turn.md"), "utf8");
  const flat = prompt.replace(/\s+/g, " ");
  const route = readFileSync(
    path.join(process.cwd(), "app", "api", "thread", "turn", "route.ts"), "utf8");
  const thread = readFileSync(path.join(process.cwd(), "lib", "thread.ts"), "utf8");
  const schemas = readFileSync(path.join(process.cwd(), "lib", "ai", "schemas.ts"), "utf8");

  // The four rules the brief names, each present in the file that enforces it.
  ok("the prompt writes the question, never the explanation to read aloud",
    /write the question the parent should ask, not the explanation/i.test(flat));
  ok("the prompt forbids stating the answer in prose",
    /Do not write the answer/i.test(flat) && /not yours to write/i.test(flat));
  ok("the prompt refuses to become a general tutor",
    /outside what this product does/i.test(flat) && /redirect/i.test(flat));
  ok("the prompt caps the reply at three sentences",
    /Three sentences or fewer/i.test(flat));
  ok("and says when depth is allowed instead", /asking for depth/i.test(flat));

  /* The intent is separate from the prose so the answer can be emitted by the
     route from the packet. A single free-text field would have made "return
     the answer card" indistinguishable from "write the answer". */
  ok("a turn carries an intent as well as a reply",
    /chatTurnSchema/.test(schemas) && /intent: z\.enum\(CHAT_INTENTS\)/.test(schemas));
  ok("the schema has no field an answer could travel in",
    /chatTurnSchema = z\.object\(\{\s*intent[^}]*reply: z\.string\(\)\.min\(1\),\s*\}\)/.test(
      schemas.replace(/\r/g, "")));

  const textCase = route.slice(route.indexOf('case "text":'));
  ok("the answer card is written from the packet, never from the reply",
    /answer: bundle\.packet\.lockedAnswer/.test(textCase));
  ok("a reply that names the answer is replaced rather than edited",
    /revealsAnswer\(turn\.reply, computed\)/.test(textCase) &&
      /leaked \? copy\.chat\.answerBehindHold : turn\.reply/.test(textCase));
  ok("and the replacement is recorded, because it should never happen",
    /logFailure\("thread-text", "A reply named the answer/.test(textCase));
  ok("advancing the ladder from a typed turn still makes no second model call",
    /intent === "next_question"/.test(textCase) && !/generatePacket/.test(textCase));
  /* Facts come from this side. A request that could describe the child's
     working would let anyone with the endpoint put words in the model's mouth
     about a child they have never seen. */
  ok("the request carries what was said and nothing else",
    /transcript: z\s*\n?\s*\.array/.test(route) &&
      !/childWorkText: parsed\.data/.test(route) &&
      /childWorkText: bundle\?\.problem\.childWorkText/.test(textCase));

  /* The one that matters most: the rendered thread must never be fed back to
     a model, because it contains the locked answer. */
  ok("the transcript excludes the answer card by construction",
    /"answer" is never included/.test(thread));

  eq("an empty thread renders an empty transcript", threadTranscript([]), []);

  {
    const turn = (role: "PARENT" | "ASSISTANT", body: string | null, cards: unknown[]) =>
      ({ id: role + body, role, body, cards, createdAt: "" }) as never;

    const lines = threadTranscript([
      turn("ASSISTANT", null, [
        { kind: "worksheet", problemId: "p1", printedText: "1/4 + 2/3 =", childWorkText: null,
          childAnswer: null, imageDataUrl: null, verification: "checked", standardCode: null,
          standardPlain: null, grade: 5 },
        { kind: "ask", problemId: "p1", question: "How did you get to this one?", rung: 0, total: 5 },
        { kind: "answer", answer: "11/12, because twelfths.", verification: "checked" },
      ]),
      turn("PARENT", "she's getting frustrated", []),
    ]);

    ok(`the transcript keeps what was said  (${lines.length} lines)`, lines.length === 3);
    ok("and never the answer", !JSON.stringify(lines).includes("11/12"));
    ok("the parent's own words are labelled as theirs",
      lines[lines.length - 1]?.role === "PARENT");
  }

  // A reply requesting the answer must not contain the computed answer string.
  ok("a reply naming the answer is caught", revealsAnswer("It is 11/12.", "11/12"));
  ok("caught mid sentence too", revealsAnswer("She should get 11/12 once she converts.", "11/12"));
  ok("caught in parentheses", revealsAnswer("The total (11/12) is what to check for.", "11/12"));
  ok("a coaching reply passes",
    !revealsAnswer("Ask her to draw a quarter and then two thirds.", "11/12"));
  /* The problem's own numbers are not the answer, and a matcher that flagged
     them would replace every legitimate reply on this worksheet. */
  ok("the question's own fractions are not the answer",
    !revealsAnswer("Start with 1/4 and 2/3 side by side.", "11/12"));
  ok("a longer number containing it is not it", !revealsAnswer("Try 111/12 next.", "11/12"));
  /* The boundary has to let a full stop through and still reject a decimal
     point. An earlier version rejected both and missed "It is 11/12.", which
     is the commonest way a reply would give it away. */
  ok("a decimal answer at the end of a sentence is caught",
    revealsAnswer("The total is 0.75.", "0.75"));
  ok("but a longer decimal is not mistaken for it",
    !revealsAnswer("The total is 0.755 exactly.", "0.75"));
  ok("nothing is claimed when there is no computable answer",
    !revealsAnswer("It is 11/12.", null));

  /* Free text needs a model, and the three ways it can be refused are three
     different situations, as with the teacher note. */
  for (const name of ["turnUnconfigured", "turnLimit", "turnFailed"] as const) {
    ok(`a refused turn says which refusal it was: ${name}`,
      typeof copy.chat[name] === "string" && copy.chat[name].length > 0 &&
        new RegExp(name).test(route));
  }
  ok("the old placeholder is gone",
    !/not switched on yet/i.test(readFileSync(path.join(process.cwd(), "lib", "copy.ts"), "utf8")));
}

// ---------------------------------------------------------------------------

section("The thread has a top bar, and it is a bar rather than a floating control");

{
  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const bar = readFileSync(path.join(process.cwd(), "components", "app", "ThreadBar.tsx"), "utf8");
  const sheet = readFileSync(path.join(process.cwd(), "components", "app", "ShareSheet.tsx"), "utf8");
  const register = readFileSync(path.join(process.cwd(), "components", "RegisterControl.tsx"), "utf8");
  const noteRoute = readFileSync(
    path.join(process.cwd(), "app", "api", "thread", "note", "route.ts"), "utf8");
  const provider = readFileSync(path.join(process.cwd(), "lib", "ai", "provider.ts"), "utf8");

  const topbar = css.slice(css.indexOf(".pp-topbar {"), css.indexOf(".pp-topbar-toggle"));

  /* The defect this section exists for: the register control sat in an
     unpainted corner and the page had nothing to anchor it. A border alone is
     not a surface. */
  ok("the bar takes the rail's ground, not the thread's",
    /background:\s*var\(--app-rail\)/.test(topbar));
  ok("the bar still divides itself from the thread",
    /border-bottom:\s*1px solid var\(--app-line\)/.test(topbar));
  /* A bar that becomes two rows pushes the thread down as the title changes,
     and the title is the thing most likely to be long. */
  ok("the bar never wraps to a second row", /flex-wrap:\s*nowrap/.test(topbar));
  ok("the bar's height is one number rather than three",
    /--topbar-h:\s*\d+px/.test(topbar) && /min-height:\s*var\(--topbar-h\)/.test(topbar));

  // Title left, setting then action right, which is where every product this
  // shell imitates puts them.
  // Scoped to the markup: the import list names the same components in a
  // different order and would answer this question wrongly.
  const markup = bar.slice(bar.indexOf("<header"));
  const order = ["pp-topbar-title", "pp-topbar-actions", "RegisterControl", "pp-topbar-share"];
  let at = -1;
  let ordered = true;
  for (const token of order) {
    const found = markup.indexOf(token);
    if (found <= at) ordered = false;
    at = found;
  }
  ok("title on the left, then the setting, then the action", ordered);

  /* Absent rather than disabled. A dead grey button is an offer the product
     cannot keep, and there is nothing to tell a teacher before a worksheet. */
  ok("Share does not appear on an empty thread", /\{problem && \(/.test(bar));
  /* The visible label is display:none at phone width, which takes it out of
     the accessibility tree along with the pixels. */
  ok("the Share button is named on the button, not only by its visible label",
    /aria-label=\{copy\.chat\.share\}/.test(bar));

  // Three segments need about 240px and a 390px bar does not have them.
  ok("the register control renders a narrow variant as well",
    /pp-register-select/.test(register) && /pp-register-segments/.test(register));
  ok("exactly one variant shows at a time, so neither is a second tab stop",
    /\.pp-register-select\s*\{\s*display:\s*none/.test(css) &&
      /\.pp-register-segments\s*\{\s*display:\s*none/.test(css.slice(css.indexOf("@media (max-width: 860px)"))));
  ok("the narrow variant is a native control rather than a hand-written menu",
    /<select/.test(register));

  // A native dialog: top layer, focus trapping and Escape are the browser's.
  ok("the share sheet is a real dialog", /<dialog/.test(sheet) && /showModal\(\)/.test(sheet));
  /* showModal centres through the UA's `inset: 0; margin: auto`. Setting width
     and max-height without restating the margin pinned it to the top left,
     which no assertion caught and a screenshot did. */
  const dialog = css.slice(css.indexOf(".pp-dialog {"), css.indexOf(".pp-dialog::backdrop"));
  ok("the dialog is centred", /margin:\s*auto/.test(dialog) && /inset:\s*0/.test(dialog));
  /* The parent sends this under their own name, so they have to be able to
     change a word of it first. */
  ok("the note is editable before it is sent", /<textarea/.test(sheet));
  ok("nothing is sent and nothing is stored", /shareFooter/.test(sheet));

  /* The teacher note is the only outward-facing thing a thread makes, so the
     press-and-hold has to survive a parent forwarding one. The guarantee is
     structural: there is no field to put an answer in. */
  const args = provider.slice(provider.indexOf("interface TeacherNoteArgs"),
    provider.indexOf("export async function generateTeacherNote"));
  ok("the teacher note has nowhere to put an answer",
    args.length > 0 && !/answer/i.test(args));
  ok("and is never handed one", !/computedAnswer|lockedAnswer/.test(noteRoute));

  /* Three refusals that are not the same thing. Telling a parent to retry in a
     minute when this deployment has no key is a small lie. */
  ok("an unconfigured deployment says so instead of asking for a retry",
    /shareUnconfigured/.test(noteRoute) && /shareLimit/.test(noteRoute));
  ok("a duration is never invented for a thread that nothing timed",
    /minutes: null/.test(noteRoute));
  ok("the prompt is told what to do with a missing duration",
    /MINUTES_SPENT is the string `null`/.test(
      readFileSync(path.join(process.cwd(), "prompts", "teacher-note.md"), "utf8")));
}

// ---------------------------------------------------------------------------

section("What a thread is called, and which problem it is on");

{
  const turn = (id: string, cards: unknown[]) =>
    ({ id, role: "ASSISTANT", body: null, cards, createdAt: "" }) as never;

  const worksheet = (problemId: string, printedText: string) => ({
    kind: "worksheet", problemId, printedText, childWorkText: null, childAnswer: null,
    imageDataUrl: null, verification: "checked", standardCode: null,
    standardPlain: "adding fractions", grade: 5,
  });

  eq("an empty thread has no title", threadTitle([]), "");
  eq("the title is the first problem read",
    threadTitle([turn("a", [worksheet("p1", "1/4 + 2/3 =")]), turn("b", [worksheet("p2", "2/5 + 1/2 =")])]),
    "1/4 + 2/3 =");

  ok("an empty thread is on no problem", currentProblem([]) === null);
  /* The newest, not the first: a parent who has photographed a second page is
     working the second page, and the note they send is about where they
     actually stopped. */
  eq("the current problem is the most recent one read",
    currentProblem([
      turn("a", [worksheet("p1", "1/4 + 2/3 =")]),
      turn("b", [worksheet("p2", "2/5 + 1/2 =")]),
    ])?.problemId,
    "p2");
  eq("it carries the misconception from its own turn",
    currentProblem([
      turn("a", [worksheet("p1", "1/4 + 2/3 ="),
        { kind: "misconception", plainName: "whole number bias", note: null,
          repairQuestion: "?", visualSvg: null }]),
    ])?.misconceptionName,
    "whole number bias");
  ok("a turn with no worksheet is skipped",
    currentProblem([turn("a", [{ kind: "text", body: "hello" }])]) === null);
}

// ---------------------------------------------------------------------------

section("Email failures are surfaced rather than swallowed");

{
  const emailSource = readFileSync(path.join(process.cwd(), "lib", "email.ts"), "utf8");
  const doctorSource = readFileSync(path.join(process.cwd(), "lib", "doctor.ts"), "utf8");
  const doctorPage = readFileSync(
    path.join(process.cwd(), "app", "(site)", "ops", "doctor", "page.tsx"),
    "utf8",
  );

  // The bug this section exists for: `result.detail` held Resend's status and
  // body, and the only thing written anywhere was `result.reason`, which is
  // one of two words and names nothing.
  const warnLine = emailSource.split("\n").find((line) => line.includes("[email] sign-in link"));
  ok("the warn line carries the provider's detail, not just the reason",
    warnLine !== undefined && warnLine.includes("${detail}"));

  ok("a failed delivery is persisted, so the detail outlives the request",
    /logFailure\(\s*FAILURE_SCOPE/.test(emailSource));
  ok("the persisted record keeps the parent's address out of the operator board",
    !/logFailure\([^)]*\$\{email\}/.test(emailSource));
  ok("the key is redacted before any detail is written",
    /function redactKey/.test(emailSource) && /redactKey\(result\.detail\)/.test(emailSource));

  ok("the doctor report carries the email picture",
    /interface DoctorEmail/.test(doctorSource) && /lastFailure/.test(doctorSource));
  ok("a configured deployment whose last send failed does not report ok",
    /mailFailure \? "fail"/.test(doctorSource));

  for (const label of ["Configured", "RESEND_FROM", "RESEND_API_KEY", "Most recent failed delivery"]) {
    ok(`/ops/doctor renders ${label}`, doctorPage.includes(`label: "${label}"`));
  }

  // Length and last four only. Anything that reaches for the value itself
  // would put a live bearer token on a page behind one password.
  ok("/ops/doctor never reaches for the key's value",
    !/process\.env\.RESEND_API_KEY/.test(doctorPage) && !/process\.env\.RESEND_API_KEY/.test(doctorSource));
  ok("emailStatus reports the key by length and tail, never in full",
    /\$\{key\.length\} characters, ending \$\{key\.slice\(-4\)\}/.test(emailSource));
}

// The parent asking for a link learns nothing about the deployment's plumbing.
// A status code or a provider name on /login is an operator's information
// leaking onto a page anyone can load.
for (const [name, text] of Object.entries(copy.login)) {
  ok(`/login copy stays generic: ${name}`,
    !/resend|\b4\d\d\b|\b5\d\d\b|api[ _-]?key|domain is not verified/i.test(text));
}

// ---------------------------------------------------------------------------

section("Prompt files carry the four standing rules");

for (const name of ["extract-worksheet", "generate-packet", "classify-move", "session-recap", "teacher-note", "chat-turn"]) {
  const text = readFileSync(path.join(process.cwd(), "prompts", `${name}.md`), "utf8");
  // The files are hard-wrapped, so a rule can straddle a line break.
  const flat = text.replace(/\s+/g, " ");
  ok(`${name}: bans the em dash`, /never write an em dash/i.test(flat));
  ok(`${name}: addresses the parent, never the child`, /never address(es)? the child/i.test(flat));
  ok(`${name}: carries the register instruction`, flat.includes("REGISTER:") || /\bRegister\b/.test(flat));
  ok(`${name}: carries the language instruction`, flat.includes("LANGUAGE:") || /\bLanguage\b/.test(flat));
  ok(`${name}: contains no em dash of its own`, !/—|―/.test(flat));
}

// ---------------------------------------------------------------------------

console.log(
  failures === 0
    ? `\n${checks} checks, all passing.`
    : `\n${checks} checks, ${failures} FAILING.`,
);
if (failures > 0) process.exitCode = 1;
