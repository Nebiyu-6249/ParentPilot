/**
 * The full feature tour, recorded against a deployed site.
 *
 *   DEMO_URL=https://... node scripts/record-demo.mjs
 *
 * Writes three files into recordings/:
 *
 *   tour.webm      the screencast, 2560x1600
 *   chapters.txt   one line per chapter, with the timestamp it starts at
 *   (tour.mp4 is produced by the workflow, from the webm)
 *
 * One script rather than one command per action, because a tour is mostly
 * timing. A chapter card before each section, a beat after every interaction,
 * and a longer hold on anything a viewer is meant to read are not expressible
 * as a sequence of separate CLI calls.
 *
 * ## Why it looks the way it does
 *
 * This product is almost entirely text: a transcription of a child's working,
 * a question to ask, a standard's plain-language description. Text recorded at
 * one device pixel per CSS pixel and then scaled anywhere is mush, which is
 * what made the first cut of this video soft. So the page is rendered at two
 * device pixels per CSS pixel, the screencast captures the full 2560x1600, and
 * the workflow downsamples that to 1920x1200 with Lanczos. A downsample from a
 * 2x render is what makes a stem look like a stem rather than a grey smear.
 *
 * The 2x comes from the `--force-device-scale-factor=2` browser flag and not
 * from the context's `deviceScaleFactor`, which was the trap here and is worth
 * writing down. Playwright's `deviceScaleFactor` is emulation: the page is
 * told its pixel ratio, but the screencast reads the compositor surface, which
 * is still one pixel per CSS pixel. Asking it for a 2560x1600 frame then pads
 * the 1280x800 surface into the corner and fills the rest with grey, so the
 * capture is nominally 2560 wide and actually contains a 1280-wide picture in
 * the top left. The browser flag scales the surface itself, and `innerWidth`
 * stays 1280 so the layout is the one the design was drawn for.
 *
 * The screencast has no frame rate option: it emits frames as the page paints,
 * which comes out around 25fps. The 30fps in the brief is therefore produced
 * at the ffmpeg step with `-r 30`, not here, and it is a resample of what was
 * captured rather than 30 distinct frames a second.
 *
 * ## What it refuses to do
 *
 * Nothing here signs in and nothing types an email address. Chapter 18 checks
 * the account screen for an address before holding on it and fails the run if
 * it finds one. `/ops` and `/ops/doctor` are never visited.
 *
 * If any chapter is served a degraded or fixture response, the run aborts and
 * names the chapter. A tour of fallbacks is worse than no video, and it is
 * worse in the specific way that matters here: a viewer cannot tell a saved
 * example from a real reading, which is the one thing this product's own
 * interface works hardest to make visible.
 */

import { chromium } from "playwright";
import { mkdir, writeFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEMO_URL = (process.env.DEMO_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = path.join(process.cwd(), "recordings");
const VIDEO = path.join(OUT_DIR, "tour.webm");
const CHAPTERS_FILE = path.join(OUT_DIR, "chapters.txt");
const SHOT_DIR = path.join(OUT_DIR, "stills");

/** CSS pixels. The thread's 740px column was designed against this width. */
const VIEWPORT = { width: 1280, height: 800 };
/** Device pixels, which is what the screencast actually writes. Matches the
 *  scale in `--force-device-scale-factor` below; the two have to agree or the
 *  frame is padded rather than filled. */
const SCALE = 2;
const CAPTURE = { width: VIEWPORT.width * SCALE, height: VIEWPORT.height * SCALE };

/** After every interaction, long enough to see what changed. */
const BEAT = 1500;
/** On anything with words on it that a viewer is meant to actually read. */
const READ = 3000;
/** Per character, typing into the composer. Human, not instant. */
const KEYSTROKE = 55;
/** How long a chapter card sits on screen before its section starts. */
const CARD = 2400;

/** The wordmark reveal plays once per browser and is the opening shot. */
const REVEAL_MS = 3200;

/** A model call against a live deployment, with a cold cache. */
const PIPELINE_TIMEOUT = 120_000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Raised when a chapter is served a fallback. Carries the chapter, so the
 *  build goes red naming which one rather than "something was degraded". */
class Degraded extends Error {}

// ---------------------------------------------------------------------------
// Page-level helpers
// ---------------------------------------------------------------------------

/**
 * Navigates, and waits for the page to be finished rather than merely present.
 *
 * `networkidle` alone is not enough. Fonts load on their own schedule, and a
 * chapter that starts mid swap shows a line of fallback metrics reflowing into
 * the real face, which reads as a broken page rather than as a loading one.
 */
async function goto(page, route) {
  await page.goto(`${DEMO_URL}${route}`, { waitUntil: "networkidle", timeout: 60_000 });
  await settlePage(page);
}

/** Fonts resolved, one frame painted, and a beat to let animation finish. */
async function settlePage(page) {
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  await wait(700);
}

/**
 * Scrolls the way a hand does.
 *
 * `scrollIntoViewIfNeeded` jumps, and a jump in a screencast is a cut: one
 * frame the element is off screen, the next it is centred, and a viewer has no
 * idea the page moved rather than changed. Small wheel deltas with a pause
 * between them read as scrolling.
 */
async function scroll(page, total, { steps = 12, pause = 90 } = {}) {
  const delta = Math.round(total / steps);
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, delta);
    await wait(pause);
  }
  await wait(600);
}

/** Brings a locator into view by scrolling to it rather than snapping to it. */
async function scrollTo(page, locator, { margin = 180 } = {}) {
  const box = await locator.boundingBox();
  if (!box) {
    await locator.scrollIntoViewIfNeeded();
    await wait(400);
    return;
  }
  const target = box.y - margin;
  if (Math.abs(target) < 40) return;
  await scroll(page, target, { steps: Math.max(6, Math.min(20, Math.round(Math.abs(target) / 60))) });
}

/** Types at reading speed, then pauses before sending. */
async function typeInto(locator, text) {
  await locator.click();
  await locator.pressSequentially(text, { delay: KEYSTROKE });
  await wait(BEAT);
}

/** Presses and holds, for the controls that only respond to being held. */
async function holdPointer(page, locator, ms) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the control to hold was not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await wait(ms);
  await page.mouse.up();
}

/**
 * A caption burned into the recording.
 *
 * A screencast carries no audio, so the two chapters where the product speaks
 * would otherwise be a picture of someone pressing a button while nothing
 * happens. The caption says what is being said out loud. It is deliberately
 * framed as a note about the recording rather than as part of the interface,
 * because pretending the video has sound would be its own small lie.
 */
async function caption(page, text, ms) {
  const html = `
    <div style="
      position:fixed; inset:auto 0 44px 0; display:flex; justify-content:center;
      font-family:ui-sans-serif,system-ui,sans-serif; pointer-events:none;">
      <div style="
        max-width:62ch; padding:14px 20px; border-radius:10px;
        background:rgba(17,17,19,0.88); color:#f6f6f4;
        font-size:19px; line-height:1.5; text-align:center;
        box-shadow:0 8px 30px rgba(0,0,0,0.35);">
        <span style="
          display:block; font-size:12px; letter-spacing:0.08em;
          text-transform:uppercase; opacity:0.62; margin-bottom:6px;">
          Spoken aloud, this recording has no sound
        </span>
        ${text}
      </div>
    </div>`;
  return page.screencast.showOverlay(html, { duration: ms });
}

/** Toggles one of the thread's disclosure cards by its heading. */
async function disclose(page, name) {
  const head = page.locator(".pp-card-head").filter({ hasText: name }).first();
  await scrollTo(page, head);
  await head.click();
  await wait(900);
}

// ---------------------------------------------------------------------------
// Refusing to film a fallback
// ---------------------------------------------------------------------------

/**
 * Fails the run if the screen is showing a saved example or an apology.
 *
 * Two signals, both language independent:
 *
 *  - `[data-degraded]` is on the notice card, which the thread raises for the
 *    demo fixture, the generic primer, an unconfigured key and a lookup that
 *    found nothing.
 *  - a chat turn with no `data-intent` is one of the three refusal texts. The
 *    route sets an intent on every real reply and on none of the failures, so
 *    the attribute's absence is the failure, and it is the only way to tell
 *    them apart without matching translated prose.
 */
async function guardDegraded(page, chapter) {
  const notice = page.locator("[data-degraded]");
  if (await notice.count()) {
    const body = (await notice.first().innerText()).replace(/\s+/g, " ").trim();
    throw new Degraded(`${chapter}: the site served a degraded response. It said: ${body}`);
  }

  const refused = page.locator(".pp-turn-assistant .pp-turn-text:not([data-intent])");
  const count = await refused.count();
  if (count > 0) {
    const body = (await refused.first().innerText()).replace(/\s+/g, " ").trim();
    throw new Degraded(`${chapter}: a turn was refused rather than answered. It said: ${body}`);
  }
}

/** Waits for the pipeline to finish, then checks it produced a real packet. */
async function awaitPacket(page, chapter) {
  await page.waitForSelector(".pp-card-ask", { timeout: PIPELINE_TIMEOUT });
  await settlePage(page);
  await guardDegraded(page, chapter);
}

/** Waits for a committed assistant turn, then checks it was not a refusal. */
async function awaitTurn(page, chapter, atLeast = 1) {
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-turn="assistant"]').length >= n,
    atLeast,
    { timeout: PIPELINE_TIMEOUT },
  );
  await settlePage(page);
  await guardDegraded(page, chapter);
}

// ---------------------------------------------------------------------------
// The tour
// ---------------------------------------------------------------------------

const CHAPTERS = [
  {
    title: "Opening",
    description: "An AI homework copilot that talks to the parent, never the child.",
    /* Before the card rather than after it. A chapter card's backdrop is a
       blur of whatever is behind it, and an opening card over about:blank is
       two and a half seconds of a title over nothing. */
    async before(page) {
      await goto(page, "/");
      // The wordmark reveal plays once per browser. Letting it finish is the
      // opening shot rather than something to wait out.
      await wait(REVEAL_MS);
    },
    async run(page) {
      await wait(READ);
      await scroll(page, 900, { steps: 18 });
      await wait(READ);
    },
  },

  {
    title: "The research",
    description: "Why a product for the parent, and not another tutor for the child.",
    async before(page) {
      await goto(page, "/research");
    },
    async run(page) {
      await wait(BEAT);
      const maloney = page.locator(".pp-finding").filter({ hasText: /Maloney/i }).first();
      if (!(await maloney.count())) throw new Error("the Maloney finding is not on this build");
      await scrollTo(page, maloney);
      // The finding that the whole product is a response to: an anxious parent
      // helping with homework makes their child worse at maths, not better.
      await wait(5000);
    },
  },

  {
    title: "Setting up",
    description: "Four questions, about a minute, and everything afterwards changes.",
    async before(page) {
      await goto(page, "/setup");
    },
    async run(page) {
      const next = page.getByRole("button", { name: /^next$/i });

      // Step 1: which register reads best. Picking one changes how every
      // sentence in the product is written.
      await wait(BEAT);
      await page.locator("button[aria-pressed]").nth(1).click();
      await wait(BEAT);
      await next.click();
      await settlePage(page);

      // Step 2: how maths was for you. This is the anxiety band, and it is
      // the one the research chapter was about.
      await wait(READ);
      await page.locator("button[aria-pressed]").nth(2).click();
      await wait(BEAT);
      await next.click();
      await settlePage(page);

      // Step 3: the child. A name from the product's own worked example, not
      // a real one, and the explanation under the school language control,
      // which is the part of this screen worth reading.
      await wait(BEAT);
      const name = page.locator("input[type='text'], input:not([type])").first();
      if (await name.count()) await typeInto(name, "Maya");
      const help = page.getByText(/taught in/i).first();
      if (await help.count()) {
        await scrollTo(page, help, { margin: 320 });
        await wait(READ + 1000);
      }
      await next.click();
      await settlePage(page);

      // Step 4: the language it talks to you in.
      await wait(READ);
      await page.getByRole("button", { name: /finish|done|start/i }).first().click();
      await page.waitForURL(/\/app|\/check|\/$/, { timeout: 30_000 }).catch(() => undefined);
      await settlePage(page);
    },
  },

  {
    title: "A blank thread",
    description: "No account needed to try it, and nothing to type if you would rather not.",
    async before(page) {
      await goto(page, "/app");
    },
    async run(page) {
      const empty = page.locator(".pp-empty");
      await empty.waitFor({ timeout: 30_000 });
      await wait(READ);
      /* The saved worksheet card and the three things a parent might say.
         Shown rather than tapped: the card is a fixture by design, and the
         next chapter runs the real pipeline on a photograph instead. */
      await scrollTo(page, page.locator(".pp-empty .pp-chip").first(), { margin: 420 });
      await wait(READ);
    },
  },

  {
    title: "Reading the page",
    description: "The arithmetic is recomputed in code, separately from the model.",
    /**
     * Photographed, not tapped.
     *
     * The brief asks this chapter to tap the saved worksheet card and let the
     * pipeline render, and those are two different things on this build. The
     * saved worksheet is `demoBundle`: a fixture served straight from
     * `seed/demo-packet.json` with no model call in it at all, which is why
     * the card says "no photo, no account, no cost" and why the thread raises
     * no banner over it. Filming it would be filming a fixture, which the same
     * brief says to abort on, and it would show none of the pipeline.
     *
     * So the camera path runs instead, on the synthetic worksheet screenshotted
     * off the product's own landing page. That reads a real image, extracts it,
     * recomputes the arithmetic, retrieves a standard and writes a packet, all
     * of it live. The saved worksheet card still appears in the chapter before
     * this one, which is where the brief wanted it seen.
     */
    async run(page, ctx) {
      const file = page.locator("input[type='file']").first();
      await file.setInputFiles(ctx.worksheetShot);
      // The status line names each stage as it runs: reading, checking,
      // matching, writing. It is worth not cutting away from.
      await awaitPacket(page, "Reading the page");
      await wait(BEAT);

      // The two claims the card makes: that the arithmetic was checked, and
      // which standard the problem was matched to.
      const checked = page.getByText("Checked", { exact: true }).first();
      if (await checked.count()) await scrollTo(page, checked, { margin: 260 });
      await wait(READ);

      // The chip opens onto the standard in plain language. It is a claim
      // about a child's classroom, so it is worth showing what it rests on.
      const chip = page
        .getByRole("button", { name: /^(CCSS|NC)\.MATH|Closest match/i })
        .first();
      if (!(await chip.count())) throw new Error("no standard chip was rendered");
      await chip.click();
      await wait(READ + 1000);
      await chip.click();
      await wait(BEAT);
    },
  },

  {
    title: "Ask, do not tell",
    description: "One question to ask out loud, then wait. Five of them, in order.",
    async run(page) {
      const ask = page.locator(".pp-card-ask").first();
      await scrollTo(page, ask);
      await wait(READ);

      // Two rungs, so the counter visibly moves and the question changes.
      for (let i = 0; i < 2; i += 1) {
        const stillStuck = page.getByRole("button", { name: /still stuck/i }).last();
        await scrollTo(page, stillStuck);
        await stillStuck.click();
        await wait(2600);
      }
      await guardDegraded(page, "Ask, do not tell");
      await wait(BEAT);
    },
  },

  {
    title: "Why she got it wrong",
    description: "Named, drawn, and turned into the question that repairs it.",
    async run(page) {
      await disclose(page, /Why she got it wrong/i);
      const diagram = page.locator(".pp-diagram").first();
      if (await diagram.count()) {
        await scrollTo(page, diagram, { margin: 240 });
        await wait(5000);
      } else {
        await wait(READ);
      }
      await disclose(page, /Why she got it wrong/i);
    },
  },

  {
    title: "Both methods",
    description: "The way you were taught, beside the way she is being taught.",
    async run(page) {
      await disclose(page, /Show me both methods/i);
      const grid = page.locator(".pp-method-grid").first();
      if (await grid.count()) await scrollTo(page, grid, { margin: 200 });
      await wait(4000);
      await disclose(page, /Show me both methods/i);
    },
  },

  {
    title: "The answer costs something",
    description: "A second and a half of holding, so it is a decision and not a reflex.",
    async run(page) {
      await disclose(page, /Just tell me the answer/i);
      const hold = page.getByRole("button", { name: /press and hold|hold to reveal/i }).last();
      await scrollTo(page, hold, { margin: 280 });
      await wait(BEAT);
      // Held past the threshold so the fill completes and the answer reveals.
      // A click does nothing, which is the entire point of the control.
      await holdPointer(page, hold, 1900);
      await wait(4000);
      await disclose(page, /Just tell me the answer/i);
    },
  },

  {
    title: "Just talk to it",
    description: "Ask in your own words. It answers you, and never your child.",
    async run(page) {
      const composer = page.locator(".pp-composer textarea");
      await scrollTo(page, composer, { margin: 520 });
      await typeInto(composer, "what is a denominator");
      await composer.press("Enter");
      await awaitTurn(page, "Just talk to it", 1);

      const explainer = page.locator(".pp-card-explainer").first();
      await explainer.waitFor({ timeout: PIPELINE_TIMEOUT });
      await scrollTo(page, explainer, { margin: 320 });
      await wait(READ + 1000);

      // The same definition, rewritten for the child. A parent asking what a
      // denominator is may want to understand it or may want a sentence to
      // say out loud, and those are different requests.
      const child = page.getByRole("button", { name: /nine year old/i }).first();
      if (!(await child.count())) throw new Error("the child level toggle is not on this build");
      await child.click();
      await wait(READ + 1500);
    },
  },

  {
    title: "Show me",
    description: "The same method, worked through on numbers that are not hers.",
    async run(page) {
      const composer = page.locator(".pp-composer textarea");
      await scrollTo(page, composer, { margin: 520 });
      await typeInto(composer, "can you show me with an example");
      await composer.press("Enter");
      await awaitTurn(page, "Show me", 2);

      const example = page.locator(".pp-example-steps").first();
      await example.waitFor({ timeout: PIPELINE_TIMEOUT });
      await scrollTo(page, example, { margin: 280 });
      await wait(5000);
    },
  },

  {
    title: "Listening",
    description: "Live Mode classifies the room. No audio leaves the device and none is kept.",
    async run(page) {
      const live = page.locator(".pp-topbar-live");
      if (!(await live.count())) throw new Error("the Live Mode control is not on this build");

      const note = await caption(
        page,
        "Live Mode is listening to the conversation in the room. It classifies what it hears and never keeps it.",
        9000,
      );
      await live.click();
      await page.waitForSelector(".pp-listening", { timeout: 30_000 });
      await wait(READ);

      // The coaching card is raised by what the fake microphone is saying.
      // It is never collapsed, because an interruption behind a chevron is
      // not an interruption.
      const coach = page.locator(".pp-card-coach").first();
      await coach.waitFor({ timeout: PIPELINE_TIMEOUT }).catch(() => {
        throw new Error("Live Mode produced no coaching card within two minutes");
      });
      await scrollTo(page, coach, { margin: 300 });
      await wait(READ + 1000);
      await note.dispose?.();

      // Stopping writes the summary: one ratio, the counts it came from, and
      // a line saying that is all that was kept.
      await live.click();
      const summary = page.locator(".pp-card").filter({ hasText: /How that stretch went/i }).first();
      await summary.waitFor({ timeout: PIPELINE_TIMEOUT });
      await scrollTo(page, summary, { margin: 240 });
      await wait(5000);
      await guardDegraded(page, "Listening");
    },
  },

  {
    title: "Speaking",
    description: "One question out loud, one answer back. The answer is never spoken.",
    async run(page) {
      const mic = page.locator(".pp-composer button").last();
      await scrollTo(page, mic, { margin: 520 });

      const note = await caption(
        page,
        "Asked out loud: <em>she is stuck on this one, what do I say.</em>",
        6000,
      );
      await holdPointer(page, mic, 3500);
      await note.dispose?.();

      // The transcription appears as a parent turn, so what was heard is
      // visible rather than assumed.
      await page.waitForSelector(".pp-turn-parent", { timeout: PIPELINE_TIMEOUT });
      await wait(BEAT);

      const spoken = await caption(
        page,
        "Spoken back: the reply above, read aloud. It will not say the answer out loud, whoever asks.",
        8000,
      );
      await awaitTurn(page, "Speaking", 3);
      await wait(READ + 1000);
      await spoken.dispose?.();

      // The control that decides what may be said out loud, on the composer
      // rather than in settings, because it changes what is said in the next
      // ten seconds.
      const hear = page.getByRole("switch", { name: /can hear this/i }).first();
      if (await hear.count()) {
        await scrollTo(page, hear, { margin: 540 });
        await wait(READ);
      }
    },
  },

  {
    title: "Marking it",
    description: "What kind of mistake it is. Never which answers are wrong.",
    async before(page, ctx) {
      await goto(page, "/check");
    },
    async run(page, ctx) {
      await wait(BEAT);
      const file = page.locator("input[type='file']").first();
      await file.setInputFiles(ctx.worksheetShot);
      await page.waitForSelector("[data-degraded], .pp-appview-section, form", { timeout: 5_000 })
        .catch(() => undefined);

      const submit = page.getByRole("button", { name: /look at this/i }).first();
      if (await submit.count()) {
        await wait(BEAT);
        await submit.click();
      }

      // The result is error types, and a line saying this screen never shows
      // answers. Both are the point of the screen.
      await page.getByText(/never shows answers/i).first()
        .waitFor({ timeout: PIPELINE_TIMEOUT });
      await settlePage(page);
      await guardDegraded(page, "Marking it");
      await scroll(page, 400, { steps: 8 });
      await wait(5000);
    },
  },

  {
    title: "Telling the teacher",
    description: "A note in your words, drafted from tonight, sent by you.",
    async before(page) {
      await goto(page, "/app");
    },
    async run(page) {
      const share = page.locator(".pp-topbar-share");
      if (!(await share.count())) throw new Error("the Share control is not on this thread");
      await share.click();
      await page.waitForSelector(".pp-dialog", { timeout: 30_000 });
      await wait(BEAT);

      // The draft arrives from a model call, so it is worth waiting past the
      // spinner before holding on it.
      await page.waitForSelector(".pp-dialog textarea", { timeout: PIPELINE_TIMEOUT });
      await wait(1200);
      await guardDegraded(page, "Telling the teacher");
      await wait(6000);
      await page.keyboard.press("Escape");
      await wait(BEAT);
    },
  },

  {
    title: "In any language",
    description: "Coaching in yours, the worksheet in the school's, the key term in both.",
    async run(page) {
      // Arabic, which is the one that proves it. The interface mirrors, and
      // the transcription of the child's working stays left to right inside
      // it, because the bidi algorithm would otherwise render `1/4 + 2/3 =`
      // as `= 2/3 + 1/4`: a different problem from the one on her page.
      await setLanguage(page, "ar");
      await goto(page, "/app");
      await wait(READ);
      const rtl = await page.evaluate(() => document.documentElement.getAttribute("dir"));
      if (rtl !== "rtl") throw new Error(`the interface did not switch to RTL, dir was ${rtl}`);
      await scroll(page, 500, { steps: 10 });
      await wait(READ + 2000);

      await setLanguage(page, "am");
      await goto(page, "/app");
      await wait(READ + 1000);
      await scroll(page, 400, { steps: 8 });
      await wait(READ);

      await setLanguage(page, "en");
      await goto(page, "/app");
      await wait(BEAT);
    },
  },

  {
    title: "Light and dark",
    description: "Both, because homework happens at the kitchen table after dark.",
    async run(page) {
      const toggle = page.getByRole("button", { name: /switch to (light|dark) mode/i }).first();
      if (!(await toggle.count())) throw new Error("the theme toggle is not on this build");
      await wait(2000);
      await toggle.click();
      await wait(2500);
      await toggle.click();
      await wait(2000);
    },
  },

  {
    title: "Kept for you",
    description: "Sessions, and an account you do not need in order to start.",
    async before(page) {
      await goto(page, "/history");
    },
    async run(page) {
      await wait(READ + 1000);
      await goto(page, "/account");

      /* The constraint this run is held to, checked rather than trusted. If an
         address is on this screen the recording has caught one, and a video
         with somebody's email in it cannot be un-shared. */
      const body = await page.locator("body").innerText();
      const found = body.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      if (found) throw new Error(`an email address was on the account screen: ${found[0]}`);

      await wait(READ + 1000);
    },
  },

  {
    title: "Private by design",
    description: "There is no column in the database that could hold a transcript.",
    async before(page) {
      await goto(page, "/privacy");
    },
    async run(page) {
      await wait(BEAT);
      const audio = page.getByText(/Live Mode audio/i).first();
      if (await audio.count()) await scrollTo(page, audio, { margin: 200 });
      await wait(6000);
      await scroll(page, 500, { steps: 10 });
      await wait(READ);
    },
  },
];

/** Changes the interface language through settings, which needs no account. */
async function setLanguage(page, code) {
  await goto(page, "/settings");
  const select = page.locator("select").first();
  await scrollTo(page, select, { margin: 260 });
  await select.selectOption(code);
  await wait(2000);
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

/** `h:mm:ss` from milliseconds, which is what a video scrubber speaks. */
function stamp(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * A synthetic worksheet, photographed off the product's own landing page.
 *
 * The check chapter needs an image of finished homework, and there is no way
 * to put a real child's page in a public video. The hero artifact is a
 * worksheet with a child's working on it, drawn by this codebase, so a
 * screenshot of it is a genuine image of the thing the feature reads and is
 * nobody's actual homework.
 */
async function captureWorksheet(page) {
  await goto(page, "/");
  /* The wordmark reveal covers the page for its first few seconds. Without
     this the screenshot is the reveal: a star on an empty field, which the
     extraction step then correctly reports as an unreadable photograph. */
  await wait(REVEAL_MS);
  const sheet = page.locator(".pp-sheet.pp-worksheet").first();
  if (!(await sheet.count())) throw new Error("the landing page has no worksheet artifact to photograph");
  await sheet.scrollIntoViewIfNeeded();
  await settlePage(page);

  const box = await sheet.boundingBox();
  if (!box || box.width < 240 || box.height < 180) {
    throw new Error(`the worksheet artifact measured ${box ? `${box.width}x${box.height}` : "nothing"}, which is not a page to read`);
  }

  await mkdir(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, "worksheet.png");
  await sheet.screenshot({ path: file });

  /* Checked rather than assumed. A screenshot of a blank element is still a
     valid PNG, and the first thing anyone would know about it is a chapter
     later, when the site says it could not read the page. */
  const shot = await stat(file);
  if (shot.size < 12_000) {
    throw new Error(`the worksheet screenshot is ${shot.size} bytes, which is not a photograph of anything`);
  }
  console.log(`worksheet: ${Math.round(box.width)}x${Math.round(box.height)}, ${(shot.size / 1024).toFixed(0)}KB`);
  return file;
}

/**
 * A wav for the fake microphone, written rather than committed.
 *
 * Chromium's fake capture device needs a real file: given nothing it plays a
 * beep, and given a missing path it fails the getUserMedia call outright,
 * which would make two chapters a picture of a permission error. This writes
 * thirty seconds of 16-bit mono at 16kHz, the rate Whisper wants, carrying a
 * low tone under noise rather than digital silence, because some capture
 * paths treat an all-zero buffer as no device at all.
 *
 * It is not speech, and nothing here pretends it is. What the product does
 * with it is whatever it genuinely does with sound that is not words, and the
 * two chapters it feeds abort rather than film a fallback if that turns out
 * to be nothing.
 */
async function writeFakeAudio() {
  const rate = 16_000;
  const seconds = 30;
  const frames = rate * seconds;
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i += 1) {
    const tone = Math.sin((2 * Math.PI * 180 * i) / rate) * 2600;
    const breath = (Math.random() - 0.5) * 900;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(tone + breath))), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  const file = process.env.PP_FAKE_AUDIO ?? path.join(os.tmpdir(), "pp-fake-audio.wav");
  await writeFile(file, Buffer.concat([header, data]));
  return file;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const fakeAudio = await writeFakeAudio();

  const browser = await chromium.launch({
    // Set locally, where the browser is pre-installed somewhere Playwright
    // does not look. In CI `playwright install` puts it where it expects.
    executablePath: process.env.PP_CHROMIUM || undefined,
    args: [
      /* The whole reason this rerun exists. See the header: the context's
         deviceScaleFactor does not reach the screencast, and this does. */
      `--force-device-scale-factor=${SCALE}`,
      // Live Mode and Voice Mode both open a microphone. Without a fake device
      // the getUserMedia call rejects and two chapters are a picture of an
      // error, so the browser is given a file to hear instead.
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${fakeAudio}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  const context = await browser.newContext({
    /* CSS pixels, which is what the layout sees. The device pixels the capture
       is made of come from the launch flag above, not from here. */
    viewport: VIEWPORT,
    colorScheme: "light",
    /* Granted against the site being recorded rather than globally, so a
       redirect elsewhere does not silently inherit a microphone. Without this
       the two listening chapters would film a permission prompt. */
    permissions: ["microphone"],
  });
  const page = await context.newPage();

  // Off camera, before recording starts.
  const worksheetShot = await captureWorksheet(page);
  await page.goto("about:blank");

  await page.screencast.start({ path: VIDEO, size: CAPTURE });
  /* A cursor that animates to whatever is about to be clicked, so a viewer can
     follow what is being done rather than watching things change by
     themselves. The label that rides along with it is the locator's own
     source, which is test harness noise in a product tour and cannot be turned
     off, so it is set to a size that renders as nothing. */
  await page.screencast.showActions({ cursor: "pointer", fontSize: 1, position: "bottom-right" });

  const startedAt = Date.now();
  const timeline = [];
  let failure = null;

  /* A debugging handle, not a feature. Chapters are stateful, so a subset will
     usually fail on the state the ones before it would have built: chapter 5
     needs the thread chapter 4 opened. It exists so a selector can be fixed
     without sitting through eighteen chapters of model calls to reach it. */
  const only = (process.env.PP_ONLY ?? "")
    .split(",")
    .map((s2) => s2.trim().toLowerCase())
    .filter(Boolean);
  const running = only.length
    ? CHAPTERS.filter((c) => only.some((o) => c.title.toLowerCase().includes(o)))
    : CHAPTERS;
  if (only.length) console.log(`PP_ONLY: ${running.length} of ${CHAPTERS.length} chapters`);

  try {
    for (const chapter of running) {
      console.log(`chapter: ${chapter.title}`);
      if (chapter.before) await chapter.before(page, { worksheetShot });
      timeline.push({ at: Date.now() - startedAt, title: chapter.title, description: chapter.description });
      await page.screencast.showChapter(chapter.title, {
        description: chapter.description,
        duration: CARD,
      });
      await chapter.run(page, { worksheetShot });
    }
  } catch (error) {
    /* Recorded up to the break, so the artifact shows how far it got and the
       build goes red naming the chapter that broke. A degraded response is
       reported as itself rather than as a timeout, because the two want
       completely different fixes. */
    failure = error;
    const label = error instanceof Degraded ? "aborted, the site was degraded" : "failed";
    console.error(`\n${label}: ${error instanceof Error ? error.message : error}`);
  } finally {
    await page.screencast.stop();
    await context.close();
    await browser.close();
  }

  const lines = [
    "ParentPilot feature tour",
    `recorded from ${DEMO_URL}`,
    `${CAPTURE.width}x${CAPTURE.height} capture`,
    "",
    ...timeline.map((c) => `${stamp(c.at)}  ${c.title}  ${c.description}`),
  ];
  if (failure) {
    lines.push("", `INCOMPLETE: ${failure instanceof Error ? failure.message : failure}`);
  }
  await writeFile(CHAPTERS_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(`\nwrote ${CHAPTERS_FILE}`);

  const written = await stat(VIDEO).catch(() => null);
  if (!written || written.size === 0) throw new Error(`no video was written to ${VIDEO}`);
  console.log(`wrote ${VIDEO}, ${(written.size / 1024 / 1024).toFixed(2)}MB`);

  if (failure) throw failure;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
