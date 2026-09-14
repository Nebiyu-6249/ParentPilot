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
  ["/capture", "button:has-text('Read this worksheet')"],
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
