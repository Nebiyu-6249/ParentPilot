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

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { copy, sanitize, sanitizeDeep } from "../lib/copy";
import { autonomyScore, countMoves } from "../lib/autonomy";
import { detectors } from "../lib/misconception";
import { evaluateMove, initialLiveState, LIVE_RULES } from "../lib/live/rules";
import { computeAnswer, verifyAnswer } from "../lib/verify";
import { sanitizeSvg } from "../lib/svg";
import { stripMetadata } from "../lib/exif";
import { packetCacheKey } from "../lib/packet";
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
  ok("emerald holds in dark mode",
    (dark["--annotation"] ?? "").toLowerCase() === "#00a878");
  // "Rules get lighter rather than darker" in dark mode.
  ok("dark rules are lighter than the surface they sit on",
    luminance(dark["--rule-on-sheet"] ?? "#000000") > luminance(dark["--surface-sheet"] ?? "#ffffff"));
}

// ---------------------------------------------------------------------------

section("Redesign direction holds");

{
  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const landing = readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");
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

  const forbidden: [string, RegExp][] = [
    ["gradients", /linear-gradient|radial-gradient|conic-gradient/],
    ["icon libraries", /lucide|react-icons|@heroicons|font-awesome/i],
    ["the forbidden typefaces", /["'\s](Inter|Geist|Space Grotesk)["',]/],
    ["glassmorphism", /backdrop-?[Ff]ilter/],
    ["skeleton loaders", /[Ss]keleton/],
    ["a non-zero border radius", /border-?[Rr]adius:\s*["']?[1-9]|borderRadius:\s*[1-9]/],
    ["springy easing", /cubic-bezier\([^)]*\b1\.[1-9]/],
  ];

  for (const [name, pattern] of forbidden) {
    const hit = source.match(pattern);
    ok(`no ${name}${hit ? `  (found ${JSON.stringify(hit[0])})` : ""}`, hit === null);
  }

  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  ok("every radius token collapses to zero", /--radius-[\w]+:\s*0px;/.test(css));
  ok("a global rule forces square corners", /\*\s*\{[^}]*border-radius:\s*0\s*!important/.test(css));
  ok("body type is at least 17px", /font-size:\s*17px/.test(css));
  ok("body line height is 1.6", /line-height:\s*1\.6/.test(css));
  ok("reduced motion is honoured", css.includes("prefers-reduced-motion: reduce"));
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

section("Prompt files carry the four standing rules");

for (const name of ["extract-worksheet", "generate-packet", "classify-move", "session-recap", "teacher-note"]) {
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
