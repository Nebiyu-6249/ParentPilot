/**
 * The product walkthrough, recorded.
 *
 *   DEMO_URL=https://... node scripts/record-demo.mjs
 *
 * One script rather than one command per action, because a demo is mostly
 * timing: a chapter card before each scene, and a beat after every interaction
 * long enough for someone to read what just changed. Neither is expressible as
 * a sequence of separate CLI calls.
 *
 * Recording is Playwright's own screencast, which writes the webm directly and
 * brings the two things a walkthrough needs with it: `showChapter` for the
 * title cards and `showActions` for a cursor that animates to whatever is
 * about to be clicked. Both beat anything hand rolled here.
 *
 * Nothing in here signs in and nothing types an email address. Every scene
 * runs on the saved worksheet, which needs no account, so the recording can
 * never contain a real child's work.
 */

import { chromium } from "playwright";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

const DEMO_URL = (process.env.DEMO_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = path.join(process.cwd(), "recordings");
const OUT_FILE = path.join(OUT_DIR, "demo.webm");

/** 720p-ish, and the width the thread's 740px column was designed against. */
const SIZE = { width: 1280, height: 800 };

/** After every interaction, long enough to read the screen. */
const BEAT = 1500;

/** The wordmark reveal on the landing page runs once and takes this long. */
const REVEAL_MS = 2800;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The storyboard.
 *
 * Kept as data so the shape of the video is readable without following the
 * control flow, and so a scene can be reordered by moving one entry.
 */
const SCENES = [
  {
    title: "The problem",
    description: "Your child is being taught a method you were never taught.",
    /* Runs before the chapter card rather than after it. A card's backdrop is
       a blur of whatever is behind it, and the opening one was landing on
       about:blank: three seconds of a title over nothing. */
    async before(page) {
      await page.goto(`${DEMO_URL}/`, { waitUntil: "networkidle" });
      // The wordmark reveal plays once per browser. Letting it finish is the
      // opening shot rather than something to skip past.
      await wait(REVEAL_MS);
    },
    async run(page) {
      const artifact = page.locator(".pp-hero-grid").first();
      if (await artifact.count()) {
        await artifact.scrollIntoViewIfNeeded();
      }
      await wait(3000);
    },
  },

  {
    title: "Read the working",
    description: "The arithmetic is recomputed here, never taken from the model.",
    async run(page) {
      await page.goto(`${DEMO_URL}/app`, { waitUntil: "networkidle" });
      await wait(BEAT);

      await page.getByRole("button", { name: /saved worksheet/i }).first().click();
      // The pipeline streams its status line while it reads, checks, matches
      // and writes. Waiting on the ask card waits for all four.
      await page.waitForSelector(".pp-card-ask", { timeout: 90_000 });
      await wait(BEAT);

      // Hold on the claim the product is making: Checked, and the standard it
      // matched the problem to.
      const badge = page.getByText("Checked", { exact: false }).first();
      if (await badge.count()) await badge.scrollIntoViewIfNeeded();
      await wait(3000);
    },
  },

  {
    title: "Ask, don't tell",
    description: "One question to ask, then wait.",
    async run(page) {
      await page.locator(".pp-card-ask").first().scrollIntoViewIfNeeded();
      await wait(2500);

      await open(page, /Why she got it wrong/i);
      await wait(3000);
      // Closed again, so the next scene opens onto a tidy thread rather than
      // a column of everything at once.
      await open(page, /Why she got it wrong/i);
      await wait(BEAT);
    },
  },

  {
    title: "Both methods",
    description: "Yours and the one the class is teaching, side by side.",
    async run(page) {
      await open(page, /Show me both methods/i);
      await wait(4000);
    },
  },

  {
    title: "The answer costs something",
    description: "A second and a half, so it is a decision rather than a reflex.",
    async run(page) {
      await open(page, /Just tell me the answer/i);
      await wait(BEAT);

      const hold = page.getByRole("button", { name: /hold/i }).last();
      await hold.scrollIntoViewIfNeeded();
      const box = await hold.boundingBox();
      if (!box) throw new Error("the press and hold control was not visible");

      // Pointer events, held past the 1500ms threshold so the fill completes
      // and the answer reveals. A click would do nothing, which is the point
      // of the control.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await wait(1900);
      await page.mouse.up();

      await wait(3500);
    },
  },

  {
    title: "Talk to it",
    description: "Ask in your own words. It answers you, never your child.",
    async run(page) {
      const composer = page.locator(".pp-composer textarea");
      await composer.scrollIntoViewIfNeeded();
      // Typed rather than filled, so the video shows it being written.
      await composer.type("she's getting frustrated", { delay: 55 });
      await wait(BEAT);
      await composer.press("Enter");

      // The reply streams in. Waiting on a committed turn rather than on the
      // preview, which carries its own class for exactly this reason.
      await page.waitForFunction(
        () => document.querySelectorAll('[data-turn="assistant"]').length > 0,
        undefined,
        { timeout: 90_000 },
      );
      await wait(3000);

      const chips = page.locator(".pp-next .pp-chip");
      if (await chips.count()) {
        await chips.first().scrollIntoViewIfNeeded();
        await wait(2500);
      }
    },
  },

  {
    title: "Share it",
    description: "A note for the teacher, in your words, sent by you.",
    async run(page) {
      const share = page.locator(".pp-topbar-share");
      if (!(await share.count())) throw new Error("the Share control is not on this build");

      await share.click();
      await page.waitForSelector(".pp-dialog", { timeout: 20_000 });
      await wait(BEAT);

      // The draft arrives from a model call, so it is worth waiting past the
      // spinner before holding on it.
      await page
        .waitForSelector(".pp-dialog-note", { timeout: 90_000 })
        .catch(() => undefined);
      await wait(4000);
    },
  },
];

/** Toggles one of the thread's disclosure cards by its heading. */
async function open(page, name) {
  const head = page.locator(".pp-card-head").filter({ hasText: name }).first();
  await head.scrollIntoViewIfNeeded();
  await head.click();
  await wait(700);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    // Set locally, where the browser is pre-installed somewhere Playwright
    // does not look. In CI `playwright install` puts it where it expects.
    executablePath: process.env.PP_CHROMIUM || undefined,
  });

  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();

  await page.screencast.start({ path: OUT_FILE, size: SIZE });
  /* A cursor that animates to whatever is about to be clicked, so a viewer can
     follow what is being done rather than watching things change by
     themselves.

     The title that rides along with it is the locator's own source, which on
     this page reads `Click locator('.pp-card-head').filter({ hasText: ... })`.
     That is test harness noise in a product demo, and there is no option to
     turn it off, so it is set to a font size that renders as nothing. */
  await page.screencast.showActions({ cursor: "pointer", fontSize: 1, position: "bottom-right" });

  let failure = null;

  try {
    for (const scene of SCENES) {
      console.log(`scene: ${scene.title}`);
      if (scene.before) await scene.before(page);
      await page.screencast.showChapter(scene.title, {
        description: scene.description,
        duration: 2200,
      });
      await scene.run(page);
    }
  } catch (error) {
    // Recorded up to the break, so the artifact still shows how far it got and
    // the build goes red naming the scene that failed.
    failure = error;
    console.error(`\nfailed during a scene: ${error instanceof Error ? error.message : error}`);
  } finally {
    await page.screencast.stop();
    await context.close();
    await browser.close();
  }

  const written = await stat(OUT_FILE).catch(() => null);
  if (!written || written.size === 0) {
    throw new Error(`no video was written to ${OUT_FILE}`);
  }
  console.log(`\nwrote ${OUT_FILE}, ${(written.size / 1024 / 1024).toFixed(2)}MB`);

  if (failure) throw failure;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
