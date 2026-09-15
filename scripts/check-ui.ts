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
  ["/live", "button:has-text('Start listening')"],
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
