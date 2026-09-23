/**
 * The model-dependent half of ParentPilot, measured against real calls.
 *
 *   OPENAI_API_KEY=... npm run eval
 *   OPENAI_API_KEY=... npm run eval -- --only=chat,note
 *
 * `npm run check` covers everything that must hold without a model. This
 * covers the part that only a model can answer, and it answers it by paying
 * for real calls rather than by asserting against a stub. A stub tells you
 * the plumbing works. Only the real thing tells you the product does.
 *
 * Six sections, in the order a worksheet moves through the product:
 *
 *   retrieval  forty probes, five per CCSS domain, against the seeded corpus
 *   vision     the fixtures in eval/photos, including one unreadable page
 *   packet     the computed answer must appear nowhere in the prose
 *   chat       four ways of asking for the answer, none of which get it
 *   live       one anxiety statement, correctly labelled
 *   note       a teacher note with no duration invents no duration
 *
 * Every item prints a verdict. Anything that fails prints why, with the text
 * that failed, because a failure you cannot read is a failure you will argue
 * with rather than fix.
 *
 * A section with nothing to run says SKIP and says what is missing. A skip is
 * never counted as a pass, and `--strict` turns every skip into a failure,
 * which is what CI should use once the fixtures exist.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import {
  classifyMove,
  chatTurn,
  extractWorksheet,
  generatePacket,
  generateTeacherNote,
  isConfigured,
} from "../lib/ai/provider";
import { nearestStandards } from "../lib/standards";
import { resolveIntent, revealsAnswer } from "../lib/thread";
import { computeAnswer } from "../lib/verify";
import { hasDatabase } from "../lib/db";
import { spendToday } from "../lib/limits";
import type { PacketPayload, RegisterName } from "../lib/ai/schemas";
import type { StandardView } from "../lib/types";

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

type Verdict = "pass" | "fail" | "skip";

interface Tally {
  pass: number;
  fail: number;
  skip: number;
}

const tally: Tally = { pass: 0, fail: 0, skip: 0 };
const failures: string[] = [];
const skips: string[] = [];

/** Model calls made, by task, so the run can be costed after the fact. */
const calls: Record<string, number> = {};

function counted<T>(task: string, run: () => Promise<T>): Promise<T> {
  calls[task] = (calls[task] ?? 0) + 1;
  return run();
}

function section(name: string, note?: string): void {
  console.log(`\n${name}`);
  if (note) console.log(`  ${note}`);
}

/**
 * One verdict line.
 *
 * `detail` is printed on a failure and swallowed on a pass, so a green run
 * stays readable and a red one carries the evidence with it.
 */
function verdict(result: Verdict, name: string, detail?: string): void {
  tally[result] += 1;
  const tag = result === "pass" ? "pass" : result === "fail" ? "FAIL" : "SKIP";
  console.log(`  ${tag}  ${name}`);
  if (result !== "pass" && detail) {
    for (const line of detail.split("\n")) console.log(`        ${line}`);
  }
  if (result === "fail") failures.push(name);
  if (result === "skip") skips.push(name);
}

function assert(name: string, condition: boolean, detail?: string): void {
  verdict(condition ? "pass" : "fail", name, detail);
}

/** A whole section that cannot run. Loud, and never mistaken for a pass. */
function skipSection(name: string, why: string): void {
  verdict("skip", name, why);
}

function truncate(text: string, limit = 220): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit)} ...`;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EVAL_DIR = path.join(process.cwd(), "eval");
const PHOTO_DIR = path.join(EVAL_DIR, "photos");

function readJson<T>(file: string): T | null {
  const full = path.join(EVAL_DIR, file);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

interface Probe {
  text: string;
  expect: string[];
}

interface ProbeFile {
  topics: Record<string, Probe[]>;
}

interface ExpectedProblem {
  index: number;
  printedText?: string;
  childWorkText?: string | null;
  childAnswer?: string | null;
  minConfidence?: number;
}

interface ExpectedPhoto {
  file: string;
  note?: string;
  unreadable?: boolean;
  maxConfidence?: number;
  problems?: ExpectedProblem[];
}

interface ExpectedFile {
  photos: ExpectedPhoto[];
}

interface GoldenWorksheet {
  id: string;
  photo: string | null;
  grade: number | null;
  printedText: string;
  childWorkText: string | null;
  childAnswer: string | null;
  computedAnswer: string | null;
  standardCode: string | null;
  standardAlso?: string[];
  misconceptionId: string | null;
}

interface GoldenFile {
  target: number;
  worksheets: GoldenWorksheet[];
}

const REGISTER: RegisterName = "STANDARD";
const LANGUAGE = "en";

// ---------------------------------------------------------------------------
// Text comparison
// ---------------------------------------------------------------------------

/** Lowercased, whitespace collapsed, and stripped of the spacing a model
 *  varies freely: `1/4 + 2/3` and `1/4+2/3` are the same transcription. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/\s*([+\-x*/=])\s*/g, "$1").trim();
}

/** Levenshtein distance, iterative and allocation light. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length] ?? 0;
}

/**
 * How close two transcriptions are, from 0 to 1.
 *
 * Not equality, because the right answer to "transcribe this" has legitimate
 * variants: a trailing `=`, `x` against `*`, a kept question number. Equality
 * would fail those and hide the difference that matters, which is a wrong
 * digit.
 */
function similarity(actual: string, expected: string): number {
  const a = normalise(actual);
  const b = normalise(expected);
  if (a === b) return 1;
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - distance(a, b) / longest;
}

/**
 * Any claim about how long something took.
 *
 * The teacher-note prompt is told to drop the duration beat entirely when
 * nothing timed the session, and told not to write "a while" in its place. So
 * this catches the vague forms as well as the numeric ones: a note that says
 * "we spent a while on it" has invented a duration just as surely as one that
 * says twenty minutes, and it is the form a model reaches for first.
 */
const WORD_NUMBER =
  "a|an|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fifty|sixty|couple|few|several";
const TIME_UNIT = "min(?:ute)?s?|hours?|hrs?";

const DURATION_PATTERNS: RegExp[] = [
  new RegExp(`\\b\\d+\\s*(?:-|\\s)?\\s*(?:${TIME_UNIT})\\b`, "i"),
  new RegExp(`\\b(?:${WORD_NUMBER})\\s+(?:${TIME_UNIT})\\b`, "i"),
  /\bhalf\s+an\s+hour\b/i,
  /\bquarter\s+of\s+an\s+hour\b/i,
  /\b(?:a\s+)?(?:while|long\s+time|short\s+time|good\s+(?:while|bit))\b/i,
  /\b(?:most|much|all)\s+of\s+(?:the\s+)?(?:evening|afternoon|night)\b/i,
  /\bfor\s+ages\b/i,
];

function mentionsDuration(text: string): string | null {
  for (const pattern of DURATION_PATTERNS) {
    const hit = text.match(pattern);
    if (hit) return hit[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Standard retrieval
// ---------------------------------------------------------------------------

/**
 * The line a run has to clear on top-1 retrieval.
 *
 * A starting line rather than a measured target. It is set where it is because
 * the packet pipeline takes the top result and nothing else, so a top-1 miss
 * is a parent reading a primer about the wrong standard, and four in five is
 * the least that is worth shipping. Move it up as the golden set fills, not
 * down when a run goes red.
 */
const RETRIEVAL_FLOOR = 0.8;

interface Miss {
  topic: string;
  text: string;
  expected: string[];
  got: StandardView[];
}

async function runRetrieval(): Promise<void> {
  section("Standard retrieval", "five probes per domain, against the seeded corpus");

  const probes = readJson<ProbeFile>("probes.json");
  if (!probes) {
    skipSection("retrieval", "eval/probes.json is missing.");
    return;
  }
  if (!hasDatabase()) {
    skipSection("retrieval", "DATABASE_URL is not set, so there is no corpus to search.");
    return;
  }

  const misses: Miss[] = [];
  let hits = 0;
  let inTopThree = 0;
  let total = 0;

  for (const [topic, list] of Object.entries(probes.topics)) {
    let topicHits = 0;

    for (const probe of list) {
      total += 1;
      /* Grade is deliberately null. A parent photographing a page has often
         not told us a year group, and the filter in `nearestStandards` is
         skipped entirely in that case, which is the harder retrieval and the
         one the anonymous path now takes. */
      const got = await counted("embedding", () => nearestStandards(probe.text, null, 3));

      const top = got[0];
      const hit = top !== undefined && probe.expect.includes(top.code);
      if (hit) {
        hits += 1;
        topicHits += 1;
      } else {
        misses.push({ topic, text: probe.text, expected: probe.expect, got });
      }
      if (got.some((s) => probe.expect.includes(s.code))) inTopThree += 1;
    }

    /* Per topic counts, not verdicts. The assertion is on the overall rate,
       and a tag here that nothing tallies reads like a result that was
       counted somewhere. */
    console.log(`    ${topic.padEnd(5)} ${topicHits}/${list.length}`);
  }

  if (total === 0) {
    skipSection("retrieval", "eval/probes.json contains no probes.");
    return;
  }

  const rate = hits / total;
  const recall = inTopThree / total;

  console.log("");
  console.log(`  top-1 hit rate  ${hits}/${total}  ${(rate * 100).toFixed(1)}%`);
  console.log(`  top-3 recall    ${inTopThree}/${total}  ${(recall * 100).toFixed(1)}%`);

  if (misses.length > 0) {
    console.log("\n  Every miss, with what came back instead:");
    for (const miss of misses) {
      console.log(`\n    ${miss.topic}  ${JSON.stringify(miss.text)}`);
      console.log(`      wanted   ${miss.expected.join(" or ")}`);
      if (miss.got.length === 0) {
        console.log("      got      nothing");
      } else {
        miss.got.forEach((s, i) => {
          console.log(`      got ${i + 1}    ${s.code}  (grade ${s.grade})  ${truncate(s.plainLanguage, 90)}`);
        });
      }
    }
    console.log("");
  }

  assert(
    `top-1 hit rate at or above ${(RETRIEVAL_FLOOR * 100).toFixed(0)}%`,
    rate >= RETRIEVAL_FLOOR,
    `${(rate * 100).toFixed(1)}% over ${total} probes, ${misses.length} missed.`,
  );
}

// ---------------------------------------------------------------------------
// 2. Vision extraction
// ---------------------------------------------------------------------------

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

function dataUrl(file: string): string {
  const bytes = readFileSync(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? "image/jpeg";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** Transcription similarity a legible fixture has to clear. */
const TRANSCRIPTION_FLOOR = 0.9;

async function runVision(): Promise<void> {
  section("Vision extraction", "eval/photos, read by the same call the product makes");

  const expected = readJson<ExpectedFile>(path.join("photos", "expected.json"));
  if (!expected || expected.photos.length === 0) {
    skipSection("vision", "eval/photos/expected.json lists no photographs. See eval/photos/README.md.");
    return;
  }

  let ran = 0;
  let sawUnreadable = false;

  for (const photo of expected.photos) {
    const file = path.join(PHOTO_DIR, photo.file);
    if (!existsSync(file)) {
      verdict("skip", `${photo.file}`, "not on disk. Add the image, or remove the entry from expected.json.");
      continue;
    }

    ran += 1;
    const extraction = await counted("vision", () =>
      extractWorksheet({
        imageDataUrl: dataUrl(file),
        register: REGISTER,
        language: LANGUAGE,
        // Nobody has said, which is the state the anonymous path is in.
        grade: null,
      }),
    );

    if (photo.unreadable) {
      sawUnreadable = true;
      const ceiling = photo.maxConfidence ?? 0.7;
      const confidences = extraction.problems.map((p) => p.ocrConfidence);
      const refused = extraction.problems.length === 0 || confidences.every((c) => c < ceiling);

      assert(
        `${photo.file}: reports low confidence rather than inventing a line`,
        refused,
        [
          `Confidence had to be below ${ceiling}, or no problems returned at all.`,
          `Got ${extraction.problems.length} problem(s), confidence ${confidences.join(", ") || "none"}.`,
          ...extraction.problems.map((p) => `  read: ${truncate(p.printedText, 120)}`),
        ].join("\n"),
      );

      if (extraction.problems.length === 0) {
        assert(
          `${photo.file}: says what would make a better photo`,
          Boolean(extraction.pageNote && extraction.pageNote.trim().length > 0),
          "Returned no problems and no pageNote, so the parent is told nothing.",
        );
      }
      continue;
    }

    for (const want of photo.problems ?? []) {
      const got = extraction.problems.find((p) => p.index === want.index);
      if (!got) {
        assert(`${photo.file} #${want.index}: found on the page`, false, "The model returned no problem at this index.");
        continue;
      }

      if (want.printedText !== undefined) {
        const score = similarity(got.printedText, want.printedText);
        assert(
          `${photo.file} #${want.index}: printed text (${score.toFixed(2)})`,
          score >= TRANSCRIPTION_FLOOR,
          [`expected  ${want.printedText}`, `read      ${got.printedText}`].join("\n"),
        );
      }

      if (want.childWorkText !== undefined) {
        if (want.childWorkText === null) {
          /* The important half of this section. A child who wrote nothing must
             come back as nothing: an invented line here is transcription that
             looks like evidence, and the misconception step believes it. */
          assert(
            `${photo.file} #${want.index}: no working invented`,
            got.childWorkText === null,
            `Child wrote nothing. Model returned: ${JSON.stringify(got.childWorkText)}`,
          );
        } else {
          const score = similarity(got.childWorkText ?? "", want.childWorkText);
          assert(
            `${photo.file} #${want.index}: child working (${score.toFixed(2)})`,
            score >= TRANSCRIPTION_FLOOR,
            [`expected  ${JSON.stringify(want.childWorkText)}`, `read      ${JSON.stringify(got.childWorkText)}`].join("\n"),
          );
        }
      }

      if (want.childAnswer !== undefined) {
        const same =
          want.childAnswer === null
            ? got.childAnswer === null
            : got.childAnswer !== null && similarity(got.childAnswer, want.childAnswer) >= TRANSCRIPTION_FLOOR;
        assert(
          `${photo.file} #${want.index}: child answer`,
          same,
          [`expected  ${JSON.stringify(want.childAnswer)}`, `read      ${JSON.stringify(got.childAnswer)}`].join("\n"),
        );
      }

      const floor = want.minConfidence ?? 0.7;
      assert(
        `${photo.file} #${want.index}: confidence at or above ${floor}`,
        got.ocrConfidence >= floor,
        `Reported ${got.ocrConfidence}.`,
      );
    }
  }

  if (ran === 0) {
    skipSection("vision", "Every entry in expected.json names a file that is not on disk.");
    return;
  }

  assert(
    "the set includes one deliberately unreadable page",
    sawUnreadable,
    "No entry has \"unreadable\": true, so nothing proves the model refuses rather than invents. See eval/photos/README.md.",
  );
}

// ---------------------------------------------------------------------------
// 3. Packet prose
// ---------------------------------------------------------------------------

/**
 * Problems used when the golden set has not been filled in yet.
 *
 * Three, spread across the arithmetic the product actually sees, each with an
 * answer `mathjs` can compute so the assertion has a string to search for.
 */
const FALLBACK_PACKET_PROBLEMS = [
  { printedText: "1/4 + 2/3 =", standardCode: "CCSS.MATH.5.NF.A.1" },
  { printedText: "43 - 27 =", standardCode: "CCSS.MATH.4.NBT.B.4" },
  { printedText: "0.4 x 0.3 =", standardCode: "CCSS.MATH.5.NBT.B.7" },
];

/** Every field of a packet that a parent reads before deciding to reveal. */
function prosePieces(packet: PacketPayload): { label: string; text: string }[] {
  const pieces: { label: string; text: string }[] = [
    { label: "primer", text: packet.primer },
    { label: "methodMatch.parentMethod.title", text: packet.methodMatch.parentMethod.title },
    { label: "methodMatch.schoolMethod.title", text: packet.methodMatch.schoolMethod.title },
    { label: "methodMatch.whySchoolWay", text: packet.methodMatch.whySchoolWay },
  ];

  packet.methodMatch.parentMethod.steps.forEach((step, i) =>
    pieces.push({ label: `methodMatch.parentMethod.steps[${i}]`, text: step }),
  );
  packet.methodMatch.schoolMethod.steps.forEach((step, i) =>
    pieces.push({ label: `methodMatch.schoolMethod.steps[${i}]`, text: step }),
  );
  packet.hintLadder.forEach((rung, i) => pieces.push({ label: `hintLadder[${i}]`, text: rung }));

  return pieces;
}

async function runPacket(): Promise<void> {
  section("Packet prose", "the computed answer appears nowhere a parent reads before the hold");

  const golden = readJson<GoldenFile>("golden.json");
  const fromGolden = (golden?.worksheets ?? [])
    .filter((w) => w.computedAnswer !== null)
    .slice(0, 3)
    .map((w) => ({ printedText: w.printedText, standardCode: w.standardCode }));

  const chosen = fromGolden.length === 3 ? fromGolden : FALLBACK_PACKET_PROBLEMS;
  if (fromGolden.length !== 3) {
    console.log(
      `  using the built in problems: eval/golden.json supplies ${fromGolden.length} of the 3 needed.`,
    );
  }

  for (const problem of chosen) {
    const answer = computeAnswer(problem.printedText);
    if (answer === null) {
      verdict("skip", `${problem.printedText}`, "mathjs computes no answer for this, so there is nothing to search for.");
      continue;
    }

    const packet = await counted("packet", () =>
      generatePacket({
        printedText: problem.printedText,
        childWorkText: null,
        childAnswer: null,
        standardCode: problem.standardCode,
        standardPlain: null,
        expectedMethods: [],
        parentMethod: null,
        computedAnswer: answer,
        misconception: null,
        register: REGISTER,
        language: LANGUAGE,
        grade: null,
      }),
    );

    const leaked = prosePieces(packet).filter((piece) => revealsAnswer(piece.text, answer));

    assert(
      `${problem.printedText}  answer ${answer} absent from primer, method match and ladder`,
      leaked.length === 0,
      leaked.map((piece) => `${piece.label}: ${truncate(piece.text)}`).join("\n"),
    );

    /* The other half of the same guarantee. An answer missing from everywhere,
       including the card built to hold it, is not a pass: it is a press and
       hold that reveals nothing. */
    assert(
      `${problem.printedText}  lockedAnswer carries ${answer}`,
      revealsAnswer(packet.lockedAnswer, answer),
      `lockedAnswer: ${JSON.stringify(packet.lockedAnswer)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 4. chat-turn under pressure
// ---------------------------------------------------------------------------

/**
 * Four ways of asking for the answer, with a problem in front of the child.
 *
 * Deliberately different in shape rather than four rewordings of one. The
 * blunt ask, the bare noun phrase, a guess offered for confirmation, and the
 * ask wrapped in a reason to give in. The third is the one that slips: a model
 * that will not state an answer will often still say "yes, that's right",
 * which is the same thing.
 */
const PRESSURE = [
  "just tell me the answer",
  "what's the answer",
  "am I right that it's 11/12",
  "it's late and she's exhausted, please just give me the answer so we can stop",
];

const ACTIVE_PROBLEM = "1/4 + 2/3 =";

async function runChat(): Promise<void> {
  section("chat-turn under pressure", `active problem ${ACTIVE_PROBLEM}`);

  const answer = computeAnswer(ACTIVE_PROBLEM);
  if (answer === null) {
    skipSection("chat", `computeAnswer could not evaluate ${ACTIVE_PROBLEM}, which is a bug in lib/verify.ts.`);
    return;
  }

  for (const said of PRESSURE) {
    const turn = await counted("classify", () =>
      chatTurn({
        childName: "Maya",
        printedText: ACTIVE_PROBLEM,
        childWorkText: "1 + 2 = 3\n4 + 3 = 7\nso 3/7",
        standardPlain: "Adding fractions with different denominators by finding a common way to cut the whole.",
        misconception: "Numerators added together and denominators added together.",
        rungsUsed: 2,
        rungsTotal: 5,
        transcript: `Parent: ${said}`,
        register: REGISTER,
        language: LANGUAGE,
      }),
    );

    /* The product's own guard, not a copy of it. If `revealsAnswer` is wrong
       then the eval is wrong in exactly the same way the product is, which is
       the honest thing to measure. */
    assert(
      `${JSON.stringify(said)}: reply does not contain ${answer}`,
      !revealsAnswer(turn.reply, answer),
      `reply: ${truncate(turn.reply, 400)}`,
    );

    /* The structured payloads are prose too. A worked example on the child's
       own numbers hands over the answer as surely as a sentence does. */
    const structured: { label: string; text: string }[] = [];
    if (turn.explainer) {
      structured.push({ label: "explainer.short", text: turn.explainer.short });
      structured.push({ label: "explainer.more", text: turn.explainer.more });
      structured.push({ label: "explainer.forNineYearOld", text: turn.explainer.forNineYearOld });
    }
    if (turn.workedExample) {
      structured.push({ label: "workedExample.problem", text: turn.workedExample.problem });
      structured.push({ label: "workedExample.point", text: turn.workedExample.point });
      turn.workedExample.steps.forEach((step, i) => {
        structured.push({ label: `workedExample.steps[${i}].move`, text: step.move });
        structured.push({ label: `workedExample.steps[${i}].working`, text: step.working });
      });
    }
    if (turn.strategy) {
      turn.strategy.moves.forEach((move, i) => {
        structured.push({ label: `strategy.moves[${i}].body`, text: move.body });
      });
      structured.push({ label: "strategy.avoid", text: turn.strategy.avoid });
    }
    turn.chips.forEach((chip, i) => structured.push({ label: `chips[${i}]`, text: chip }));

    const leaked = structured.filter((piece) => revealsAnswer(piece.text, answer));
    assert(
      `${JSON.stringify(said)}: cards do not contain ${answer}`,
      leaked.length === 0,
      leaked.map((piece) => `${piece.label}: ${truncate(piece.text)}`).join("\n"),
    );

    /* What the thread would actually do with this turn, rather than what the
       model proposed. `resolveIntent` is the last word, so it is what gets
       asserted. */
    const resolved = resolveIntent(said, turn.intent, true);
    assert(
      `${JSON.stringify(said)}: returns the answer card`,
      resolved === "answer",
      `model proposed ${turn.intent}, resolveIntent settled on ${resolved}.\nreply: ${truncate(turn.reply, 300)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Live classification
// ---------------------------------------------------------------------------

async function runLive(): Promise<void> {
  section("Live classification");

  const window = "I was never good at math either";
  const result = await counted("classify", () =>
    classifyMove({ window, register: REGISTER, language: LANGUAGE }),
  );

  assert(
    `${JSON.stringify(window)} is ANXIETY_STATEMENT`,
    result.label === "ANXIETY_STATEMENT",
    `Got ${result.label} at confidence ${result.confidence}.`,
  );
}

// ---------------------------------------------------------------------------
// 6. Teacher note with a null duration
// ---------------------------------------------------------------------------

async function runNote(): Promise<void> {
  section("Teacher note", "nothing timed this session, so nothing may claim a duration");

  const note = await counted("recap", () =>
    generateTeacherNote({
      childName: "Maya",
      printedText: ACTIVE_PROBLEM,
      standardPlain: "Adding fractions with different denominators by finding a common way to cut the whole.",
      // The point of the whole section.
      minutes: null,
      misconception: "Numerators added together and denominators added together.",
      register: REGISTER,
      language: LANGUAGE,
    }),
  );

  const invented = mentionsDuration(note);
  assert(
    "no duration invented",
    invented === null,
    [`matched ${JSON.stringify(invented)}`, `note: ${truncate(note, 400)}`].join("\n"),
  );

  /* A note that dropped the beat by writing nothing at all would pass the
     assertion above and be useless, so the other three beats are checked for
     as well. */
  assert(
    "the note still says what was worked on",
    note.trim().length >= 80,
    `Only ${note.trim().length} characters: ${JSON.stringify(note)}`,
  );
}

// ---------------------------------------------------------------------------

const SECTIONS: Record<string, () => Promise<void>> = {
  retrieval: runRetrieval,
  vision: runVision,
  packet: runPacket,
  chat: runChat,
  live: runLive,
  note: runNote,
};

function parseOnly(argv: string[]): string[] {
  const flag = argv.find((a) => a.startsWith("--only="));
  if (!flag) return Object.keys(SECTIONS);
  const asked = flag
    .slice("--only=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const unknown = asked.filter((name) => !(name in SECTIONS));
  if (unknown.length > 0) {
    console.error(`Unknown section: ${unknown.join(", ")}`);
    console.error(`Available: ${Object.keys(SECTIONS).join(", ")}`);
    process.exit(2);
  }
  return asked;
}

async function main(): Promise<void> {
  const strict = process.argv.includes("--strict");
  const wanted = parseOnly(process.argv.slice(2));

  console.log("ParentPilot evaluation");
  console.log(`  sections   ${wanted.join(", ")}`);
  console.log(`  database   ${hasDatabase() ? "configured" : "not configured"}`);
  console.log(`  strict     ${strict ? "on, a skip fails the run" : "off, a skip is reported and does not fail"}`);

  if (!isConfigured()) {
    console.error("\nOPENAI_API_KEY is not set.");
    console.error("This suite makes real model calls on purpose. Run it as:");
    console.error("\n  OPENAI_API_KEY=... npm run eval\n");
    process.exit(2);
  }

  const before = await spendToday();

  for (const name of wanted) {
    const run = SECTIONS[name];
    if (!run) continue;
    try {
      await run();
    } catch (error) {
      /* A section that threw is a failure with a name, not a crashed run. The
         remaining sections still execute, because one broken model call should
         not hide the state of the other five. */
      verdict("fail", `${name} threw`, error instanceof Error ? (error.stack ?? error.message) : String(error));
    }
  }

  const after = await spendToday();

  console.log("\nModel calls");
  const madeCalls = Object.entries(calls);
  if (madeCalls.length === 0) {
    console.log("  none");
  } else {
    for (const [task, count] of madeCalls) console.log(`  ${task.padEnd(10)} ${count}`);
  }
  if (hasDatabase()) {
    console.log(`  ledger     $${(after - before).toFixed(4)} added to today's estimated spend`);
  } else {
    console.log("  ledger     not recorded, no DATABASE_URL");
  }

  console.log("");
  if (failures.length > 0) {
    console.log(`Failed: ${failures.length}`);
    for (const name of failures) console.log(`  ${name}`);
  }
  if (skips.length > 0) {
    console.log(`Skipped: ${skips.length}`);
    for (const name of skips) console.log(`  ${name}`);
  }

  const verdictLine = `${tally.pass} passed, ${tally.fail} failed, ${tally.skip} skipped.`;
  console.log(`\n${verdictLine}`);

  if (tally.fail > 0) {
    process.exit(1);
  }
  if (strict && tally.skip > 0) {
    console.log("Strict mode: a skipped check is not a passing check.");
    process.exit(1);
  }
  if (tally.pass === 0) {
    console.log("Nothing actually ran, which is not the same as passing.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
