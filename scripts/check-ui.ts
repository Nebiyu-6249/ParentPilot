/**
 * Browser checks for rules that cannot be verified from source.
 *
 *   npm run build && npm run start &
 *   npm run check:ui                      (or PP_BASE_URL=... npm run check:ui)
 *
 * "No screen should require scrolling to reach its primary action" and "the
 * question is the biggest text on the screen" are both claims about layout at
 * a real viewport size. Asserting them by eye means they hold until the next
 * person adds a paragraph. These measure.
 */

import { chromium, type Browser } from "playwright";

const BASE = process.env.PP_BASE_URL ?? "http://localhost:3000";
const EXECUTABLE = process.env.PP_CHROMIUM;

let failures = 0;
let checks = 0;

function ok(name: string, condition: boolean): void {
  checks += 1;
  if (!condition) failures += 1;
  console.log(`  ${condition ? "ok  " : "FAIL"}  ${name}`);
}

function section(name: string): void {
  console.log(`\n${name}`);
}

/** Every screen, and the selector for its one primary action. */
const SCREENS: [string, string][] = [
  ["/problem/demo", "button:has-text('Still stuck')"],
  // /capture is now a redirect into the thread; the camera is its first action.
  ["/app", "button:has-text('Take a photo of the page')"],
  ["/setup", "button:has-text('Next')"],
  ["/check", "button:has-text('Look at this')"],
  // /live is a redirect into the thread now; its control is the composer's
  // microphone, which is covered by the Live Mode section below.
];

/** Two real phone sizes. The small one is the constraint that matters. */
const VIEWPORTS: [number, number, string][] = [
  [390, 844, "iPhone-ish"],
  [360, 640, "small Android"],
];

async function run(browser: Browser): Promise<void> {
  for (const [width, height, label] of VIEWPORTS) {
    section(`Primary action above the fold at ${width}x${height} (${label})`);
    const context = await browser.newContext({ viewport: { width, height } });

    for (const [url, selector] of SCREENS) {
      const page = await context.newPage();
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      // The intro overlay plays once per browser and would sit over everything.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      const box = await page
        .locator(selector)
        .first()
        .boundingBox()
        .catch(() => null);
      const scrollY = await page.evaluate(() => window.scrollY);

      if (!box) {
        ok(`${url}: primary action found`, false);
      } else {
        const bottom = Math.round(box.y + box.height);
        ok(`${url}: reachable without scrolling  (${bottom}px of ${height}px)`,
          bottom <= height && scrollY === 0);
      }
      await page.close();
    }
    await context.close();
  }

  section("The problem screen is one question");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/problem/demo`, { waitUntil: "networkidle" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  const largest = await page.evaluate(() => {
    const found: { text: string; px: number }[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const text = (el.textContent ?? "").trim();
      if (!text || el.children.length > 0) continue;
      found.push({ text, px: parseFloat(getComputedStyle(el).fontSize) });
    }
    return found.sort((a, b) => b.px - a.px)[0] ?? null;
  });

  ok(`the largest text on the screen is the question to ask  (${largest?.px ?? 0}px)`,
    largest !== null && largest.text.trim().endsWith("?"));

  const openByDefault = await page.evaluate(() => document.querySelectorAll("details[open]").length);
  const totalDisclosures = await page.evaluate(() => document.querySelectorAll("details").length);
  ok(`every disclosure is closed by default  (${totalDisclosures} present)`, openByDefault === 0);

  // The answer must not be in the document before the parent opens it and
  // holds the control. A collapsed <details> still renders its contents, so
  // this is a real check rather than a formality.
  const answerLeak = await page.locator("text=11/12").count();
  ok("the answer is not in the page before it is asked for", answerLeak === 0);

  // Still stuck advances one rung, and one only.
  const rungOne = await page.locator("text=/Question 1 of 5/").count();
  await page.locator("button:has-text('Still stuck')").click();
  await page.waitForTimeout(300);
  const rungTwo = await page.locator("text=/Question 2 of 5/").count();
  ok("Still stuck advances the ladder exactly one rung", rungOne === 1 && rungTwo === 1);

  await context.close();

  await runAppSurface(browser);
}

/**
 * The chat surface, driven the way a parent drives it.
 *
 * These are the claims that only hold at a real viewport with real state: the
 * drawer must not cover the thread on a phone, the question must still be the
 * biggest thing on screen now that it sits inside a card, and the answer must
 * still be absent from the document until it is asked for.
 */
async function runAppSurface(browser: Browser): Promise<void> {
  section("The thread at 390x844");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // The rail is a drawer at this width. Opening /app with it open would hide
  // the thread behind it, which is what it did when this was first built.
  const railCovers = await page.evaluate(() => {
    const rail = document.querySelector(".pp-rail");
    if (!rail) return true;
    return rail.getBoundingClientRect().right > 8;
  });
  ok("the sidebar does not cover the thread on a phone", !railCovers);

  /* The grid has three rail states and the media query used to override only
     one of them, so a collapsed rail on a phone put the thread in the 0-width
     track. Measuring the thread is the only way that stays caught. */
  const threadWidth = await page.evaluate(() => {
    const el = document.querySelector(".pp-thread-wrap");
    return el ? Math.round(el.getBoundingClientRect().width) : 0;
  });
  ok(`the thread fills the phone  (${threadWidth}px of 390px)`, threadWidth >= 380);

  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  ok("nothing overflows sideways", !overflows);

  await page.locator("button:has-text('saved worksheet')").first().click();
  await page.waitForSelector(".pp-card-ask", { timeout: 60000 });
  await page.waitForTimeout(400);

  const largest = await page.evaluate(() => {
    const found: { text: string; px: number }[] = [];
    for (const el of Array.from(document.querySelectorAll(".pp-thread-inner *"))) {
      const text = (el.textContent ?? "").trim();
      if (!text || el.children.length > 0) continue;
      found.push({ text, px: parseFloat(getComputedStyle(el).fontSize) });
    }
    return found.sort((a, b) => b.px - a.px)[0] ?? null;
  });
  ok(`the question is the biggest text in the thread  (${largest?.px ?? 0}px)`,
    largest !== null && largest.text.trim().endsWith("?"));

  ok("the answer is not in the thread before it is asked for",
    (await page.locator("text=11/12").count()) === 0);

  // Everything but the question is collapsed, or the thread is a wall again.
  const openBodies = await page.locator(".pp-card .pp-card-body").count();
  ok(`only the worksheet and the question are open  (${openBodies} open)`, openBodies <= 3);

  const before = await page.locator(".pp-card-ask").count();
  await page.locator("button:has-text('Still stuck')").first().click();
  await page.waitForTimeout(1200);
  const after = await page.locator(".pp-card-ask").count();
  ok("Still stuck adds one turn to the thread", after === before + 1);
  ok("the new rung is the second question",
    (await page.locator("text=/Question 2 of 5/").count()) === 1);

  // The composer stays reachable while the thread grows.
  const composer = await page.locator(".pp-composer").boundingBox();
  ok(`the composer stays on screen  (${Math.round(composer?.y ?? 0)}px)`,
    composer !== null && composer.y + composer.height <= 844);

  /* The placeholder has to fit on one line at phone width. It was 196px in a
     194px box, and the second line was clipped rather than shown, so the
     parent read "Tell me what is". Measured against the font that actually
     rendered, not the one we hoped would load. */
  const fit = await page.evaluate(() => {
    const ta = document.querySelector(".pp-composer textarea") as HTMLTextAreaElement | null;
    if (!ta) return null;
    const cs = getComputedStyle(ta);
    const probe = document.createElement("span");
    probe.style.font = cs.font;
    probe.style.whiteSpace = "nowrap";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.textContent = ta.placeholder;
    document.body.appendChild(probe);
    const text = probe.getBoundingClientRect().width;
    probe.remove();
    const box = ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { text: Math.round(text), box: Math.round(box) };
  });
  ok(`the composer placeholder fits on one line  (${fit?.text ?? 0}px in ${fit?.box ?? 0}px)`,
    fit !== null && fit.text <= fit.box);

  await context.close();

  await runTopBar(browser);
}

/**
 * The top bar, measured rather than described.
 *
 * Every defect this bar was built to fix was a layout fact: a control in an
 * unpainted corner, a bar that wrapped, three segments in a 390px strip. None
 * of them is visible from the source, so none of them is asserted there.
 */
async function runTopBar(browser: Browser): Promise<void> {
  section("The thread's top bar at 1280x860");
  let context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  let page = await context.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  /* The bar has to be a surface, not a strip of thread with a line under it.
     Comparing the painted pixels is the only way that stays caught when a
     token moves. */
  const grounds = await page.evaluate(() => {
    /* The thread column paints nothing of its own and shows the grid behind
       it, so reading its own background returns rgba(0,0,0,0) and comparing
       against that proves nothing. Walk up to whatever actually paints.

       Written as a loop rather than a helper on purpose: esbuild adds a
       __name call around a named function expression and that helper does not
       exist inside the page, so a tidier version throws at runtime. */
    const out: Record<string, string> = {};
    for (const [key, selector] of [
      ["bar", ".pp-topbar"],
      ["thread", ".pp-thread"],
      ["rail", ".pp-rail"],
    ]) {
      let at: Element | null = document.querySelector(selector as string);
      if (!at) return null;
      let found = "rgba(0, 0, 0, 0)";
      while (at) {
        const value = getComputedStyle(at).backgroundColor;
        if (value && value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
          found = value;
          break;
        }
        at = at.parentElement;
      }
      out[key as string] = found;
    }
    return { bar: out.bar ?? "", thread: out.thread ?? "", rail: out.rail ?? "" };
  });
  ok(`the bar is not the same surface as the thread  (${grounds?.bar} on ${grounds?.thread})`,
    grounds !== null && grounds.bar !== grounds.thread);
  ok("the bar and the sidebar are one continuous chrome surface",
    grounds !== null && grounds.bar === grounds.rail);

  // One row. Two rows would move the thread down as the title changes.
  const rows = await page.evaluate(() => {
    const bar = document.querySelector(".pp-topbar");
    if (!bar) return 99;
    /* Centres, not tops: a 21px title and a 32px button share a row and do
       not share a top edge. Rounded to 4px so sub-pixel layout does not read
       as a second row. */
    const kids = Array.from(bar.children).filter((el) => (el as HTMLElement).offsetParent !== null);
    const centres = kids.map((el) => {
      const box = el.getBoundingClientRect();
      return Math.round((box.top + box.bottom) / 2 / 4);
    });
    return new Set(centres).size;
  });
  ok(`the bar is a single row  (${rows} distinct tops)`, rows === 1);

  // Share is an offer, and there is nothing to offer before a worksheet.
  ok("Share is absent on an empty thread",
    (await page.locator(".pp-topbar-share").count()) === 0);

  await page.locator("button:has-text('saved worksheet')").first().click();
  await page.waitForSelector(".pp-card-ask", { timeout: 60000 });
  await page.waitForTimeout(400);

  ok("Share appears once there is a worksheet",
    (await page.locator(".pp-topbar-share").count()) === 1);
  ok("the bar names the thread",
    (await page.locator(".pp-topbar-title").innerText()).trim().length > 0);

  // The register control and Share must not collide with the title.
  const fits = await page.evaluate(() => {
    const title = document.querySelector(".pp-topbar-title");
    const actions = document.querySelector(".pp-topbar-actions");
    if (!title || !actions) return false;
    return title.getBoundingClientRect().right <= actions.getBoundingClientRect().left + 1;
  });
  ok("the title never runs under the controls", fits);

  /* The dialog is centred by the UA's own margin, which a rule that sets
     width and max-height has to restate. It did not, and it opened pinned to
     the top left corner of the window. */
  await page.locator(".pp-topbar-share").click();
  await page.waitForTimeout(600);
  const centred = await page.evaluate(() => {
    const el = document.querySelector(".pp-dialog");
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return {
      dx: Math.abs((box.left + box.right) / 2 - window.innerWidth / 2),
      dy: Math.abs((box.top + box.bottom) / 2 - window.innerHeight / 2),
    };
  });
  ok(`the share sheet opens centred  (${Math.round(centred?.dx ?? 999)}px, ${Math.round(centred?.dy ?? 999)}px off)`,
    centred !== null && centred.dx < 4 && centred.dy < 4);

  // Escape closes it, which is the browser's job and is worth confirming.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("Escape closes it", (await page.locator(".pp-dialog").count()) === 0);

  await context.close();

  section("The thread's top bar at 390x844");
  context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  /* Three segments need about 240px. At this width the control is the picker
     a phone already knows how to render, and the segments are gone from the
     tab order rather than merely hidden. */
  const narrow = await page.evaluate(() => {
    const select = document.querySelector(".pp-register-select");
    const segments = document.querySelector(".pp-register-segments");
    return {
      select: select ? getComputedStyle(select).display : "absent",
      segments: segments ? getComputedStyle(segments).display : "absent",
    };
  });
  ok(`the register control collapses to a picker  (select ${narrow.select}, segments ${narrow.segments})`,
    narrow.select !== "none" && narrow.segments === "none");

  const focusables = await page.evaluate(() =>
    document.querySelectorAll(".pp-topbar [role='radio']:not([hidden])").length);
  const reachable = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".pp-topbar [role='radio']"))
      .filter((el) => (el as HTMLElement).offsetParent !== null).length);
  ok(`the hidden variant is not a second set of tab stops  (${reachable} of ${focusables} reachable)`,
    reachable === 0);

  await page.locator("button:has-text('saved worksheet')").first().click();
  await page.waitForSelector(".pp-card-ask", { timeout: 60000 });
  await page.waitForTimeout(400);

  // The label goes; the accessible name must not go with it.
  const named = await page.locator(".pp-topbar-share").getAttribute("aria-label");
  ok(`the Share button keeps a name when its label is hidden  (${named})`,
    named !== null && named.length > 0);

  const barRows = await page.evaluate(() => {
    const bar = document.querySelector(".pp-topbar");
    if (!bar) return 99;
    /* Centres, not tops: a 21px title and a 32px button share a row and do
       not share a top edge. Rounded to 4px so sub-pixel layout does not read
       as a second row. */
    const kids = Array.from(bar.children).filter((el) => (el as HTMLElement).offsetParent !== null);
    const centres = kids.map((el) => {
      const box = el.getBoundingClientRect();
      return Math.round((box.top + box.bottom) / 2 / 4);
    });
    return new Set(centres).size;
  });
  ok(`the bar is still a single row on a phone  (${barRows} distinct tops)`, barRows === 1);

  ok("nothing overflows sideways", !(await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth)));

  await context.close();

  await runFreeText(browser);
  await runLiveToggle(browser);
  await runMarketing(browser);
  await runSettledScreens(browser);
  await runTranscript(browser);
}

/**
 * The failing transcript, replayed.
 *
 * Every line here returned the wrong thing before this round. They are driven
 * through the real endpoint rather than the pure functions, because the bug
 * was never in one function: it was the prompt, the classifier and the router
 * disagreeing about what a question was.
 *
 * What this cannot check is the prose, which is the model's half. It checks
 * the half that is code: which cards come back, and whether the answer to the
 * problem in front of the child is among them.
 */
async function runTranscript(browser: Browser): Promise<void> {
  section("The failing transcript, line by line");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });

  const say = async (text: string, problemId: string | null) =>
    page.evaluate(
      async ([said, active]) => {
        const response = await fetch("/api/thread/turn", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "text",
            text: said,
            problemId: active,
            rung: 0,
            register: "STANDARD",
            transcript: [],
          }),
        });
        const lines = (await response.text()).trim().split("\n").filter(Boolean);
        const final = JSON.parse(lines[lines.length - 1] ?? "{}") as {
          cards?: { kind: string; intent?: string; body?: string }[];
        };
        const cards = final.cards ?? [];
        return {
          kinds: cards.map((c) => c.kind),
          intent: cards.find((c) => c.kind === "text")?.intent ?? null,
          prose: cards.filter((c) => c.kind === "text").map((c) => c.body ?? "").join(" "),
        };
      },
      [text, problemId] as const,
    );

  // With a problem in front of the child, so the press and hold is live.
  const denominator = await say("what is a denominator", "demo");
  ok(`"what is a denominator" is a definition, not the answer  (${denominator.intent})`,
    denominator.intent === "explain" && !denominator.kinds.includes("answer"));

  const bare = await say("what", "demo");
  ok(`a bare "what" asks for it again, not for the answer  (${bare.intent})`,
    bare.intent === "clarify" && !bare.kinds.includes("answer"));

  const example = await say("can you show me with examples", "demo");
  ok(`"can you show me with examples" is an example  (${example.intent})`,
    example.intent === "example" && !example.kinds.includes("answer"));

  // The one case that must still reach it.
  const wanted = await say("just tell me the answer", "demo");
  ok(`"just tell me the answer" still returns the answer card  (${wanted.intent})`,
    wanted.intent === "answer" && wanted.kinds.includes("answer"));

  /* The invariant, restated against every reply above: none of them may name
     the demo problem's computed answer. */
  const proseSoFar = [denominator, bare, example, wanted].map((r) => r.prose).join(" ");
  ok("no reply named the active problem's answer", !proseSoFar.includes("11/12"));

  // With nothing in front of the child, nothing is held back and nothing
  // is refused for being off topic.
  for (const [said, label] of [
    ["how do i teach my kid calculus", "calculus"],
    ["what is the powerhouse of the cell", "biology"],
  ] as const) {
    const out = await say(said, null);
    ok(`"${said}" is answered  (${out.intent})`,
      out.intent !== "redirect" && !out.kinds.includes("answer") && out.prose.length > 20);
    ok(`and the ${label} reply is not a help desk line`,
      !/this tool|this product|i can'?t assist|feel free to/i.test(out.prose));
  }

  const offTopic = await say("write me a python script that scrapes a website", null);
  ok(`an unrelated request is redirected  (${offTopic.intent})`, offTopic.intent === "redirect");

  /* Typed arithmetic is a worksheet. This is pure routing, so it does not
     depend on how the model behind it classifies anything. */
  for (const sum of ["4 * 4", "1/2 + 2/3 =", "1 + 1"]) {
    const out = await say(sum, null);
    ok(`"${sum}" runs the problem pipeline  (${out.kinds.join("+") || "nothing"})`,
      out.kinds.includes("worksheet") && out.kinds.includes("ask"));
    ok(`"${sum}" claims no misconception, since no working was typed`,
      !out.kinds.includes("misconception"));
  }

  await context.close();
}

/**
 * The screens a parent goes to and comes straight back from.
 *
 * Measured in dark mode specifically. The failure this catches is a paper
 * token surviving on the product surface, which computes fine in the
 * stylesheet and renders as dark text on a dark ground in the browser.
 */
async function runSettledScreens(browser: Browser): Promise<void> {
  section("The settled screens, in dark mode");
  for (const route of ["/account", "/settings", "/history", "/login", "/check"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    ok(`${route} is on the product surface`, (await page.locator(".pp-appview").count()) === 1);
    ok(`${route} is off the marketing layout`, (await page.locator(".pp-nav").count()) === 0);
    ok(`${route} offers one way back`, (await page.locator(".pp-back").count()) === 1);

    /* Every visible run of text against the ground it is actually painted on.
       4.5 because these are all normal-size labels, and because 3:1 let white
       on brand emerald through at 3.06 across five screens. What the token
       check in `npm run check` cannot see is which pairs actually meet on a
       rendered page, which is why this measures as well. */
    const worst = await page.evaluate(() => {
      /* Luminance is computed inline rather than in a helper: esbuild wraps a
         named function expression in a __name call that does not exist inside
         the page, and a tidier version throws at runtime. Noted once already
         in this file and repeated here because it is easy to undo. */
      let lowest = { ratio: 99, text: "" };
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const text = (el.textContent ?? "").trim();
        if (!text || el.children.length > 0) continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;

        const fg = getComputedStyle(el).color;
        let bg = "rgba(0, 0, 0, 0)";
        let at: Element | null = el;
        while (at) {
          const value = getComputedStyle(at).backgroundColor;
          if (value && value !== "rgba(0, 0, 0, 0)" && value !== "transparent") {
            bg = value;
            break;
          }
          at = at.parentElement;
        }

        const lums: number[] = [];
        for (const colour of [fg, bg]) {
          const parts = colour.match(/\d+(\.\d+)?/g);
          if (!parts || parts.length < 3) {
            lums.push(1);
            continue;
          }
          const channels: number[] = [];
          for (const value of parts.slice(0, 3)) {
            const c = Number(value) / 255;
            channels.push(c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
          }
          lums.push(0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0));
        }

        const a = lums[0] ?? 1;
        const b = lums[1] ?? 1;
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        if (ratio < lowest.ratio) lowest = { ratio, text: text.slice(0, 40) };
      }
      return lowest;
    });

    ok(`${route} has no unreadable text  (worst ${worst.ratio.toFixed(2)}:1 on "${worst.text}")`,
      worst.ratio >= 4.5);

    await context.close();
  }
}

/**
 * Live Mode, as a control rather than a destination.
 *
 * The microphone cannot actually be granted in this browser, so what is
 * asserted here is the folding in: that the separate screen is gone, that the
 * control is in the composer, and that it is a toggle rather than a link.
 * Whether it hears anything is a question for a device with a microphone.
 */
async function runLiveToggle(browser: Browser): Promise<void> {
  section("Live Mode is a control in the thread, not a screen");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/live`, { waitUntil: "networkidle" });
  ok(`/live redirects into the thread  (${new URL(page.url()).pathname})`,
    new URL(page.url()).pathname === "/app");

  await page.waitForTimeout(300);
  const mic = page.locator(".pp-composer button[aria-pressed]");
  ok("the composer carries the microphone as a toggle", (await mic.count()) === 1);
  ok("and it starts off", (await mic.getAttribute("aria-pressed")) === "false");
  ok("it is a button, not a link to somewhere else",
    (await mic.evaluate((el) => el.tagName)) === "BUTTON");

  /* The old screen is gone rather than orphaned. A component still in the tree
     with its own copy of the session logic is the thing that drifts. */
  ok("nothing still links to a Live Mode screen",
    (await page.locator("a[href='/live']").count()) === 0);

  await context.close();
}

/**
 * The marketing pages.
 *
 * Server rendered, so the assertion worth making is that the content is in the
 * HTML rather than painted in afterwards, along with the tags that decide what
 * a shared link looks like.
 */
async function runMarketing(browser: Browser): Promise<void> {
  section("The marketing pages");
  const pages: [string, string][] = [
    ["/how-it-works", "How it works"],
    ["/research", "Research"],
    ["/for-teachers", "For teachers"],
  ];

  for (const [route, name] of pages) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    // Scripting off: whatever survives is what a crawler and a slow phone get.
    const response = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const html = (await response?.text()) ?? "";

    ok(`${route} responds 200`, response?.status() === 200);
    ok(`${route} is server rendered  (${Math.round(html.length / 1024)}kb of HTML)`,
      html.includes("<h1") && html.length > 4000);
    ok(`${route} titles itself`, (await page.title()).startsWith(name));

    const og = await page.locator('meta[property="og:title"]').getAttribute("content");
    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    ok(`${route} carries an OG title  (${og})`, og !== null && og.includes(name));
    ok(`${route} carries a description`, desc !== null && desc.length > 40);

    ok(`${route} can be reached from the header`,
      (await page.locator(`header a[href='${route}']`).count()) > 0);

    await context.close();
  }

  /* One nav change took every page on this surface to a 468px scroll width at
     phone size, and none of the existing assertions covered the site header.
     They do now. */
  section("The site surface fits a phone");
  for (const route of ["/", "/privacy", "/how-it-works", "/research", "/for-teachers"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    ok(`${route} does not scroll sideways  (${widths.scroll}px in ${widths.client}px)`,
      widths.scroll <= widths.client);
    await context.close();
  }
}

/**
 * Typing into the thread.
 *
 * The two assertions the brief names are behavioural, so they are made here
 * against a running deployment rather than against the source: a turn asking
 * for the answer must not put the answer in the thread, and an unrelated
 * request must come back as a redirect.
 *
 * Both need a model. Without one the turn is refused with an honest sentence,
 * which is itself worth asserting, and the pair above is reported as unrun
 * rather than quietly passing.
 */
async function runFreeText(browser: Browser): Promise<void> {
  section("Typing into the thread");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // The demo carries a known locked answer, so there is something definite to
  // look for in the thread.
  await page.locator("button:has-text('saved worksheet')").first().click();
  await page.waitForSelector(".pp-card-ask", { timeout: 60000 });
  await page.waitForTimeout(400);

  const say = async (words: string): Promise<string> => {
    const before = await page.locator(".pp-turn-text").count();
    await page.locator(".pp-composer textarea").fill(words);
    await page.locator(".pp-composer textarea").press("Enter");
    await page.waitForFunction(
      (n) => document.querySelectorAll(".pp-turn-text").length > n,
      before,
      { timeout: 90000 },
    );
    await page.waitForTimeout(400);
    return (await page.locator(".pp-turn-text").last().innerText()).trim();
  };

  const first = await say("just tell me the answer, it is late");

  /* A reply this product wrote itself carries no intent; only a model's does.
     That is the honest test of whether the two assertions below can run,
     rather than matching one refusal sentence: the turn is refused when there
     is no key and also when the hourly ceiling is reached, and driving this
     suite repeatedly reaches it. */
  const replied = (await page.locator(".pp-turn-text").last().getAttribute("data-intent")) !== null;

  if (!replied) {
    console.log(`  note  the turn was refused, so the two turn assertions did not run: "${first}"`);
    ok("a refused turn says so rather than swallowing what the parent typed", first.length > 0);
    await context.close();
    return;
  }

  /* The assertion this whole feature is built around. The answer exists in the
     turn, behind the press and hold, and nowhere in the prose. */
  const prose = (await page.locator(".pp-turn-text").allInnerTexts()).join(" ");
  ok("a turn asking for the answer does not put the answer in the thread",
    !prose.includes("11/12"));
  ok("it returns the answer card instead",
    (await page.locator(".pp-turn-assistant").last().locator("text=/tell me the answer/i").count()) > 0 ||
      (await page.locator("[data-intent='answer']").count()) > 0);
  ok("and the answer is still behind the hold",
    (await page.evaluate(() => document.body.innerText.includes("11/12"))) === false);

  const second = await say("can you help her with her spelling homework as well");
  const intent = await page.locator(".pp-turn-text").last().getAttribute("data-intent");
  ok(`an unrelated question is redirected  (intent ${intent})`, intent === "redirect");
  ok("the redirect is short and says what this does instead",
    second.length > 0 && second.split(/(?<=[.!?])\s+/).filter(Boolean).length <= 3);

  ok("no reply anywhere in the thread contains the answer",
    !(await page.locator(".pp-turn-text").allInnerTexts()).join(" ").includes("11/12"));

  await context.close();
}

async function main(): Promise<void> {
  const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
  try {
    await run(browser);
  } finally {
    await browser.close();
  }

  console.log(
    failures === 0 ? `\n${checks} browser checks, all passing.` : `\n${checks} browser checks, ${failures} FAILING.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
