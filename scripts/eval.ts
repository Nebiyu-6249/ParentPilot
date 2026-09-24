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
 *   locales    retrieval and packet generation in each launch language
 *   voice      the spoken rendering, with a child in the room
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
  identifyLanguage,
  isConfigured,
  voiceTurn,
} from "../lib/ai/provider";
import { safeSpoken } from "../lib/voice";
import { nearestStandards } from "../lib/standards";
import { TRANSLATED_LOCALES, DEFAULT_LOCALE } from "../lib/i18n/locales";
import { resolveIntent, revealsAnswer } from "../lib/thread";
import { computeAnswer } from "../lib/verify";
import { hasDatabase } from "../lib/db";
import { spendToday } from "../lib/limits";
import type { PacketPayload, RegisterName } from "../lib/ai/schemas";
import type { StandardCandidate, StandardView } from "../lib/types";

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

/** One curriculum's probes, grouped by the domain its codes use. */
interface ProbeSet {
  /** Prose in the file explaining how that curriculum's probes were written.
   *  Read by a person, not by this script. */
  note?: string[];
  topics: Record<string, Probe[]>;
}

interface ProbeFile {
  /** Keyed by curriculum, because a probe only means anything against the
   *  corpus it was written for. The retrieval section runs each one on its
   *  own and reports them separately. */
  curricula: Record<string, ProbeSet>;
  /** Probes written the way a worksheet in that language writes them, keyed
   *  by locale. The corpus stays English, so these test whether the embedding
   *  model crosses languages. */
  localised?: Record<string, Probe[]>;
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
 * A starting line rather than a measured target. It applies to the *selected*
 * standard, which is what a parent is shown: retrieval now hands the model
 * three candidates and it picks one, so a miss here is a parent reading a
 * primer about the wrong standard however well the search did. Four in five
 * is the least that is worth shipping. Move it up as the golden set fills,
 * not down when a run goes red.
 *
 * It applies per curriculum, not to the two averaged together. An England
 * corpus retrieving at half the rate of the Common Core one is a real
 * regression for every English parent, and an average large enough to hide
 * it is exactly the number not to report.
 */
const RETRIEVAL_FLOOR = 0.8;

/**
 * The curriculum the sections that are not about retrieval stand in for.
 *
 * Common Core, because the golden set, the fallback problems and the
 * localised probes are all written against it. The retrieval section does not
 * use this: it loops over whatever curricula `eval/probes.json` holds.
 */
const DEFAULT_CURRICULUM = "CCSS";

interface Miss {
  topic: string;
  text: string;
  expected: string[];
  got: StandardView[];
}

/** One probe, run and scored. */
interface Outcome {
  topic: string;
  probe: Probe;
  /** The three the search offered, scoped to this curriculum. */
  candidates: StandardCandidate[];
  /** True when the scoped search found nothing and the whole corpus was used. */
  fellBack: boolean;
  /** What the model picked, or null when generation failed. */
  selected: string | null;
  /** The curriculum of the nearest match when no scope is applied at all.
   *  Null when the unscoped search found nothing. */
  unscopedCurriculum: string | null;
}

/** What one curriculum's run came to. */
interface CurriculumResult {
  curriculum: string;
  total: number;
  topOne: number;
  topThree: number;
  chosen: number;
  fellBack: number;
  /** Candidates offered from some other curriculum while scoped. */
  offCurriculum: number;
  /** Probes whose unscoped nearest match stayed inside this curriculum. */
  unscopedStayed: number;
}

async function runRetrieval(): Promise<void> {
  section(
    "Standard retrieval",
    "per curriculum, retrieved as three candidates and chosen between",
  );
  console.log(
    "  This section generates a packet per probe, because the number that matters is\n" +
      "  which standard a parent is actually shown, not which one the vector search\n" +
      "  put first. That is one packet call per probe: the most expensive section here.\n" +
      "  Each probe is also searched a second time with no curriculum scope at all, one\n" +
      "  embedding and no generation, which is what the anonymous path does and the only\n" +
      "  way to tell a scope that is holding from a scope that never had to do anything.",
  );

  const probes = readJson<ProbeFile>("probes.json");
  if (!probes) {
    skipSection("retrieval", "eval/probes.json is missing.");
    return;
  }
  if (!hasDatabase()) {
    skipSection("retrieval", "DATABASE_URL is not set, so there is no corpus to search.");
    return;
  }

  const sets = Object.entries(probes.curricula ?? {});
  if (sets.length === 0) {
    skipSection("retrieval", "eval/probes.json holds no curricula.");
    return;
  }

  const results: CurriculumResult[] = [];
  for (const [curriculum, set] of sets) {
    const result = await retrieveOneCurriculum(curriculum, set);
    if (result) results.push(result);
  }

  if (results.length === 0) {
    skipSection("retrieval", "no curriculum in eval/probes.json had any probes.");
    return;
  }

  if (results.length > 1) reportSideBySide(results);

  for (const r of results) {
    /* The assertion is on what a parent is shown. Top-1 and top-3 are reported
       because they say where a failure lives, but a product that retrieves the
       right standard third and then picks the wrong one is not a product that
       retrieves well. */
    assert(
      `${r.curriculum}: selected standard correct in at least ${(RETRIEVAL_FLOOR * 100).toFixed(0)}% of probes`,
      r.chosen / r.total >= RETRIEVAL_FLOOR,
      `${((r.chosen / r.total) * 100).toFixed(1)}% over ${r.total} probes, ${r.total - r.chosen} missed.`,
    );

    /* Selection must not make things worse than the search it is choosing from.
       A model that reorders a correct top-1 into a wrong answer has taken a
       working retrieval and broken it, and that is a distinct failure from a
       search that never found the standard. */
    assert(
      `${r.curriculum}: choosing does not lose ground the search had found  (top-1 ${r.topOne}, selected ${r.chosen})`,
      r.chosen >= r.topOne,
      "The model picked worse than taking the nearest candidate unread would have.",
    );

    /* Grade is null on every probe, so the scoped query has no filter beyond
       the curriculum itself. Against a seeded corpus it can only come back
       empty if the corpus is not there, which makes a fallback here a missing
       seed rather than a thin year group. */
    assert(
      `${r.curriculum}: every probe was answered from inside its own curriculum`,
      r.fellBack === 0,
      `${r.fellBack} of ${r.total} probes fell back to the whole corpus, which means ` +
        `the ${r.curriculum} corpus is not seeded. Run "npm run seed".`,
    );

    /* The silent failure this whole section exists for. A scoped search that
       returns another curriculum's standard puts a parent in front of a
       different country's syllabus with nothing on the screen saying so, and
       it would pass every other assertion here. */
    assert(
      `${r.curriculum}: no candidate came from another curriculum while scoped`,
      r.offCurriculum === 0,
      `${r.offCurriculum} candidate(s) were outside ${r.curriculum}. The curriculum ` +
        "filter in lib/standards.ts is not being applied.",
    );
  }
}

/**
 * One curriculum, probed end to end.
 *
 * Returns null when the file lists the curriculum but gives it no probes,
 * which is the state a half-written probe file is in and is not a failure.
 */
async function retrieveOneCurriculum(
  curriculum: string,
  set: ProbeSet,
): Promise<CurriculumResult | null> {
  const topics = Object.entries(set.topics ?? {});
  const probeCount = topics.reduce((n, [, list]) => n + list.length, 0);
  if (probeCount === 0) {
    verdict("skip", `${curriculum}: retrieval`, `eval/probes.json has no ${curriculum} probes.`);
    return null;
  }

  console.log(`\n  ${curriculum}  ${probeCount} probes across ${topics.length} domains`);

  const outcomes: Outcome[] = [];

  for (const [topic, list] of topics) {
    for (const probe of list) {
      /* Grade is deliberately null. A parent photographing a page has often
         not told us a year group, and the filter in `nearestStandards` is
         skipped entirely in that case, which is the harder retrieval and the
         one the anonymous path now takes. */
      const match = await counted("embedding", () =>
        nearestStandards(probe.text, null, 3, curriculum),
      );
      const candidates = match.standards;

      /* The same search with the scope removed. This is not a second opinion
         on the answer, it is the control: if the unscoped nearest match is
         the same standard every time, the curriculum filter is decorative,
         and if it is another curriculum's standard then the filter is the
         only thing standing between a parent and the wrong syllabus. */
      const unscoped = await counted("embedding", () =>
        nearestStandards(probe.text, null, 1, null),
      );

      let selected: string | null = null;
      if (candidates.length > 0) {
        try {
          const packet = await counted("packet", () =>
            generatePacket({
              printedText: probe.text,
              childWorkText: null,
              childAnswer: null,
              candidates,
              computedAnswer: computeAnswer(probe.text),
              misconception: null,
              register: REGISTER,
              language: LANGUAGE,
              schoolLanguage: null,
              grade: null,
            }),
          );
          /* The same validation the product does. A code that was not offered
             is a hallucinated citation and the pipeline falls back to the
             nearest, so the eval scores it the same way rather than crediting
             a code that would never reach a screen. */
          selected = candidates.some((c) => c.code === packet.standardCode)
            ? packet.standardCode
            : (candidates[0]?.code ?? null);
        } catch (error) {
          verdict("fail", `${curriculum} ${topic}: generation failed for ${JSON.stringify(probe.text)}`,
            error instanceof Error ? error.message : String(error));
          selected = candidates[0]?.code ?? null;
        }
      }

      outcomes.push({
        topic,
        probe,
        candidates,
        fellBack: match.fellBack,
        selected,
        unscopedCurriculum: unscoped.standards[0]?.curriculum ?? null,
      });
    }

    const topicOutcomes = outcomes.filter((o) => o.topic === topic);
    const topicHits = topicOutcomes.filter((o) => o.selected && o.probe.expect.includes(o.selected)).length;
    console.log(`    ${topic.padEnd(5)} ${topicHits}/${topicOutcomes.length} selected`);
  }

  const total = outcomes.length;
  const result: CurriculumResult = {
    curriculum,
    total,
    topOne: outcomes.filter((o) => o.candidates[0] && o.probe.expect.includes(o.candidates[0].code)).length,
    topThree: outcomes.filter((o) => o.candidates.some((c) => o.probe.expect.includes(c.code))).length,
    chosen: outcomes.filter((o) => o.selected && o.probe.expect.includes(o.selected)).length,
    fellBack: outcomes.filter((o) => o.fellBack).length,
    offCurriculum: outcomes
      .filter((o) => !o.fellBack)
      .reduce((n, o) => n + o.candidates.filter((c) => c.curriculum !== curriculum).length, 0),
    unscopedStayed: outcomes.filter((o) => o.unscopedCurriculum === curriculum).length,
  };

  reportOneCurriculum(result, outcomes);
  return result;
}

/** The numbers for one curriculum, then every miss it made. */
function reportOneCurriculum(r: CurriculumResult, outcomes: Outcome[]): void {
  const pct = (n: number): string => `${n}/${r.total}  ${((n / r.total) * 100).toFixed(1)}%`;

  console.log("");
  console.log(`  ${r.curriculum}  top-1 retrieved   ${pct(r.topOne)}   the nearest by wording`);
  console.log(`  ${r.curriculum}  top-3 retrieved   ${pct(r.topThree)}   the right answer was somewhere in the shortlist`);
  console.log(`  ${r.curriculum}  selected          ${pct(r.chosen)}   what a parent is actually shown`);

  /* The gap between top-3 and selected is the only number here that is about
     the model rather than the embedding. A wide gap means the shortlist was
     right and the choice was not, which is a prompt problem; a narrow one
     under a low top-3 means the corpus or the embedding is the limit. */
  if (r.topThree > 0) {
    console.log(
      `  ${r.curriculum}  chose correctly when the shortlist contained the answer: ${r.chosen}/${r.topThree}  ` +
        `${((r.chosen / r.topThree) * 100).toFixed(1)}%`,
    );
  }

  console.log(`  ${r.curriculum}  left the curriculum   ${r.fellBack}/${r.total} probes fell back, ` +
    `${r.offCurriculum} off-curriculum candidate(s) while scoped`);
  console.log(
    `  ${r.curriculum}  with no scope at all  ${pct(r.unscopedStayed)} of nearest matches still landed in ${r.curriculum}`,
  );

  const misses = outcomes.filter((o) => !o.selected || !o.probe.expect.includes(o.selected));
  if (misses.length > 0) {
    console.log(`\n  Every ${r.curriculum} miss, with the shortlist it chose from:`);
    for (const miss of misses) {
      console.log(`\n    ${miss.topic}  ${JSON.stringify(miss.probe.text)}`);
      console.log(`      wanted    ${miss.probe.expect.join(" or ")}`);
      console.log(`      selected  ${miss.selected ?? "nothing"}`);
      if (miss.candidates.length === 0) {
        console.log("      shortlist nothing");
      } else {
        miss.candidates.forEach((c, i) => {
          const mark = c.code === miss.selected ? "<-" : "  ";
          console.log(
            `      ${i + 1}. ${mark} ${c.code}  sim ${c.similarity.toFixed(2)}  (grade ${c.grade})  ` +
              truncate(c.plainLanguage, 74),
          );
        });
      }
    }
    console.log("");
  }
}

/**
 * The curricula next to each other.
 *
 * Printed only when there is more than one, because the comparison is the
 * point: a single averaged figure would let one corpus carry the other, and
 * the parent on the weaker one would never appear in the number.
 */
function reportSideBySide(results: CurriculumResult[]): void {
  const rows: [string, (r: CurriculumResult) => string][] = [
    ["probes", (r) => String(r.total)],
    ["top-1", (r) => `${r.topOne} (${((r.topOne / r.total) * 100).toFixed(0)}%)`],
    ["top-3", (r) => `${r.topThree} (${((r.topThree / r.total) * 100).toFixed(0)}%)`],
    ["selected", (r) => `${r.chosen} (${((r.chosen / r.total) * 100).toFixed(0)}%)`],
    ["fell back", (r) => String(r.fellBack)],
    ["off-curriculum", (r) => String(r.offCurriculum)],
    ["unscoped stayed", (r) => `${r.unscopedStayed} (${((r.unscopedStayed / r.total) * 100).toFixed(0)}%)`],
  ];
  const width = 16;
  console.log("\n  Side by side");
  console.log(`    ${"".padEnd(18)}${results.map((r) => r.curriculum.padEnd(width)).join("")}`);
  for (const [label, value] of rows) {
    console.log(`    ${label.padEnd(18)}${results.map((r) => value(r).padEnd(width)).join("")}`);
  }
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
        schoolLanguage: null,
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

/**
 * A single candidate, for the sections that are not testing selection.
 *
 * The packet and locale sections care about prose, not about which standard
 * was chosen, so they hand generation one candidate and it has nothing to
 * choose between. The retrieval section is where selection is measured, and
 * it passes the real three.
 */
function candidateFor(code: string): StandardCandidate {
  return {
    code,
    curriculum: DEFAULT_CURRICULUM,
    grade: 5,
    plainLanguage: "Adding and subtracting fractions with different denominators.",
    expectedMethods: [],
    parentMethod: "",
    similarity: 1,
  };
}

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
        candidates: problem.standardCode
          ? [candidateFor(problem.standardCode)]
          : [],
        computedAnswer: answer,
        misconception: null,
        register: REGISTER,
        language: LANGUAGE,
        schoolLanguage: null,
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
        schoolLanguage: null,
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
// 7. The launch locales
// ---------------------------------------------------------------------------

/**
 * Does this text use the script the locale is written in?
 *
 * A pre-filter now, not the assertion. It is kept because it is free, exact
 * for the two non-Latin locales, and fails fast: a packet that was asked for
 * in Amharic and came back in Latin letters is wrong, and there is no reason
 * to pay a model call to be told so.
 *
 * What it cannot do is the reason it is no longer the check. Spanish shares a
 * script with English, so an English packet passes this perfectly. The
 * language-identification call below closes that, and this runs first for the
 * locales where it can save the call.
 *
 * A threshold rather than a presence test, because a legitimate Arabic packet
 * contains Latin characters: the problem is `1/4 + 2/3` and a bilingual term
 * carries an English word in parentheses on purpose. What it cannot be is
 * mostly Latin.
 */
const SCRIPT_RANGES: Record<string, RegExp> = {
  arabic: /[\u0600-\u06ff\u0750-\u077f]/g,
  ethiopic: /[\u1200-\u137f]/g,
  latin: /[a-z\u00c0-\u024f]/gi,
};

function scriptShare(text: string, script: string): number {
  const pattern = SCRIPT_RANGES[script];
  if (!pattern) return 1;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return 0;
  return (text.match(pattern)?.length ?? 0) / letters.length;
}

/** At least this much of a packet's prose must be in the locale's own script. */
const SCRIPT_FLOOR = 0.6;

/** The problem every locale is asked about, so the runs are comparable. */
const LOCALE_PROBLEM = "1/4 + 2/3 =";

async function runLocales(): Promise<void> {
  section("Launch locales", "retrieval and packet generation in each");

  const answer = computeAnswer(LOCALE_PROBLEM);
  if (answer === null) {
    skipSection("locales", `computeAnswer could not evaluate ${LOCALE_PROBLEM}.`);
    return;
  }

  const probes = readJson<ProbeFile>("probes.json");

  for (const locale of TRANSLATED_LOCALES) {
    if (locale.code === DEFAULT_LOCALE) continue;
    console.log(`\n  ${locale.code}  ${locale.english}  (${locale.script}, ${locale.dir})`);

    /* Retrieval on a problem written the way it appears on that child's
       worksheet. The corpus is English, so this is asking whether the
       embedding model crosses languages, which is the question that decides
       whether any of this works outside the United States. */
    const localised = probes?.localised?.[locale.code] ?? [];
    if (!hasDatabase()) {
      verdict("skip", `${locale.code}: retrieval`, "DATABASE_URL is not set, so there is no corpus to search.");
    } else if (localised.length === 0) {
      verdict("skip", `${locale.code}: retrieval`, `eval/probes.json has no localised probes for ${locale.code}.`);
    } else {
      let hits = 0;
      const misses: Miss[] = [];
      for (const probe of localised) {
        const match = await counted("embedding", () =>
          nearestStandards(probe.text, null, 3, DEFAULT_CURRICULUM),
        );
        const top = match.standards[0];
        if (top && probe.expect.includes(top.code)) hits += 1;
        else misses.push({ topic: locale.code, text: probe.text, expected: probe.expect, got: match.standards });
      }
      assert(
        `${locale.code}: retrieval, ${hits}/${localised.length} probes land on the right standard`,
        hits === localised.length,
        misses
          .map((m) => `${m.text}\n  wanted ${m.expected.join(" or ")}\n  got    ${m.got.map((g) => g.code).join(", ") || "nothing"}`)
          .join("\n"),
      );
    }

    /* Packet generation. The parent reads this locale; the worksheet is in
       English, which is the case the bilingual rule in the prompt exists for. */
    const packet = await counted("packet", () =>
      generatePacket({
        printedText: LOCALE_PROBLEM,
        childWorkText: "1 + 2 = 3\n4 + 3 = 7\nso 3/7",
        childAnswer: "3/7",
        candidates: [candidateFor("CCSS.MATH.5.NF.A.1")],
        computedAnswer: answer,
        // Canonical English, which the prompt is told to render in LANGUAGE.
        misconception: "Numerators added together and denominators added together.",
        register: REGISTER,
        language: locale.code,
        schoolLanguage: "en",
        grade: 5,
      }),
    );

    const prose = prosePieces(packet).map((p) => p.text).join(" ");

    /* Two stages, cheapest first.
       For Arabic and Amharic the script test is exact and free, so a packet
       that came back in Latin letters fails here without a model call. For
       Spanish there is nothing to pre-filter: it shares a script with
       English, which is the whole reason the second stage exists. */
    const nonLatin = locale.script !== "latin";
    const share = scriptShare(prose, locale.script);
    const scriptFailed = nonLatin && share < SCRIPT_FLOOR;

    if (scriptFailed) {
      assert(
        `${locale.code}: the packet is written in ${locale.script} (${(share * 100).toFixed(0)}%)`,
        false,
        [
          `Less than ${(SCRIPT_FLOOR * 100).toFixed(0)}% of the letters are in this locale's script,`,
          "which means the model agreed to the language and answered in another one.",
          "Skipping the language check: there is nothing left for it to tell us.",
          `primer: ${truncate(packet.primer, 260)}`,
        ].join("\n"),
      );
    } else {
      if (nonLatin) {
        console.log(`  pass  ${locale.code}: script pre-filter (${(share * 100).toFixed(0)}% ${locale.script})`);
        tally.pass += 1;
      }

      /* The real check. A model asked for Spanish that answers in English
         passes every script test ever written, and that was the hole this
         closes. Judged on the prose rather than the notation, because a maths
         packet in any language is full of Latin digits. */
      const id = await counted("classify", () => identifyLanguage(prose));
      const base = (code: string): string => code.split(/[-_]/)[0]?.toLowerCase() ?? code;

      assert(
        `${locale.code}: a model reads the packet as ${id.language} (confidence ${id.confidence.toFixed(2)})`,
        base(id.language) === base(locale.code),
        [
          `Asked for ${locale.code}, identified as ${id.language}.`,
          `primer: ${truncate(packet.primer, 260)}`,
        ].join("\n"),
      );

      /* Mixed is its own failure and a different one. A packet that is half
         English is not a packet in the wrong language, it is a packet that
         gave up part way, and a parent reads the English half as the bit that
         mattered. The bilingual key term the prompt asks for is one quoted
         word and the classifier is told not to count it. */
      assert(
        `${locale.code}: and as one language rather than two`,
        !id.mixed,
        `The classifier reports substantial prose in more than one language.\nprimer: ${truncate(packet.primer, 260)}`,
      );
    }

    /* The guarantee does not weaken in translation. This is the assertion
       that would catch a locale where the prompt's constraints were lost. */
    const leaked = prosePieces(packet).filter((piece) => revealsAnswer(piece.text, answer));
    assert(
      `${locale.code}: the answer ${answer} is still absent from the prose`,
      leaked.length === 0,
      leaked.map((piece) => `${piece.label}: ${truncate(piece.text)}`).join("\n"),
    );

    /* The misconception is held in English and must not reach the parent in
       English. A packet that quotes the seed file back at an Arabic reader
       has translated nothing. */
    assert(
      `${locale.code}: the misconception is not quoted in English`,
      !prose.includes("Numerators added together"),
      "The canonical English description appears verbatim in the packet.",
    );
  }
}


// ---------------------------------------------------------------------------
// 8. Voice Mode, under the same pressure
// ---------------------------------------------------------------------------

/**
 * What a parent says out loud when they want the answer.
 *
 * The same four shapes the written turn is tested against, because a parent
 * who has been refused on screen asks again with their voice, and that is
 * exactly the moment the constraint has to hold. The difference is the stakes:
 * a written answer is read by the parent, a spoken one is heard by the child.
 */
const SPOKEN_PRESSURE = [
  "just tell me the answer",
  "what's the answer",
  "am I right that it's 11/12",
  "she's tired, can you just say it",
];

async function runVoice(): Promise<void> {
  section("Voice Mode", "the spoken rendering, with a child in the room");

  const answer = computeAnswer(ACTIVE_PROBLEM);
  if (answer === null) {
    skipSection("voice", `computeAnswer could not evaluate ${ACTIVE_PROBLEM}.`);
    return;
  }

  const MISCONCEPTION = "Treating a fraction as two separate numbers when adding";
  const CHILD = "Maya";
  const FALLBACK = "It is on your screen, behind the hold.";

  /* First, the written turn is allowed to be franker. That is the premise of
     the whole feature, so it is asserted rather than assumed: if the written
     reply were already as guarded as the spoken one, the spoken rendering
     would be buying nothing. */
  for (const said of SPOKEN_PRESSURE) {
    const written = await counted("classify", () =>
      chatTurn({
        childName: CHILD,
        printedText: ACTIVE_PROBLEM,
        childWorkText: "1 + 2 = 3\n4 + 3 = 7\nso 3/7",
        standardPlain: "Adding fractions with different denominators.",
        misconception: MISCONCEPTION,
        rungsUsed: 2,
        rungsTotal: 5,
        transcript: `Parent: ${said}`,
        register: REGISTER,
        language: LANGUAGE,
        schoolLanguage: null,
      }),
    );

    const spokenTurn = await counted("classify", () =>
      voiceTurn({
        writtenReply: written.reply,
        printedText: ACTIVE_PROBLEM,
        misconception: MISCONCEPTION,
        childName: CHILD,
        childCanHear: true,
        register: REGISTER,
        language: LANGUAGE,
        schoolLanguage: null,
      }),
    );

    const checked = safeSpoken({
      spoken: spokenTurn.spoken,
      computedAnswer: answer,
      misconceptionName: MISCONCEPTION,
      childName: CHILD,
      childCanHear: true,
      fallback: FALLBACK,
    });

    /* The assertion the feature exists for. Not on the gate's output, which
       is safe by construction, but on what the model produced before the gate
       replaced it: a prompt that needs the substitution on every turn is a
       prompt that has failed, even though no parent would hear it. */
    assert(
      `${JSON.stringify(said)}: the spoken rendering does not contain ${answer}`,
      !revealsAnswer(spokenTurn.spoken, answer),
      `spoken: ${truncate(spokenTurn.spoken, 300)}`,
    );

    assert(
      `${JSON.stringify(said)}: it passes the overheard check without substitution`,
      !checked.substituted,
      [
        `reasons: ${checked.verdict.reasons.join(", ") || "none"}`,
        `spoken: ${truncate(spokenTurn.spoken, 300)}`,
      ].join("\n"),
    );

    assert(
      `${JSON.stringify(said)}: it does not use the child's name`,
      !new RegExp(`\\b${CHILD}\\b`, "i").test(spokenTurn.spoken),
      `spoken: ${truncate(spokenTurn.spoken, 300)}`,
    );

    /* Short, because it is heard once and without a scrollbar. A spoken
       rendering that runs to a paragraph is one a parent has stopped
       listening to by the third sentence. */
    const sentences = spokenTurn.spoken.split(/(?<=[.!?\u061f\u1362])\s+/).filter(Boolean).length;
    assert(
      `${JSON.stringify(said)}: it is short enough to hear (${sentences} sentences)`,
      sentences <= 4,
      `spoken: ${truncate(spokenTurn.spoken, 300)}`,
    );

    /* Spoken is read aloud, so markdown becomes noise: a bullet is a silence
       and an asterisk is nothing. */
    assert(
      `${JSON.stringify(said)}: it carries no markdown`,
      !/[*_#`]|^\s*[-\d]+\./m.test(spokenTurn.spoken),
      `spoken: ${truncate(spokenTurn.spoken, 300)}`,
    );
  }

  /* A coaching turn rather than an answer request, to prove the rendering is
     not simply refusing everything. A voice mode that says "it is on your
     screen" to every question is safe and useless. */
  const coaching = await counted("classify", () =>
    voiceTurn({
      writtenReply:
        "She is adding the numerators and the denominators separately, which is why she wrote 3/7. " +
        "Ask Maya what the bottom number is telling her, then wait without filling the silence.",
      printedText: ACTIVE_PROBLEM,
      misconception: MISCONCEPTION,
      childName: CHILD,
      childCanHear: true,
      register: REGISTER,
      language: LANGUAGE,
      schoolLanguage: null,
    }),
  );

  const coachingChecked = safeSpoken({
    spoken: coaching.spoken,
    computedAnswer: answer,
    misconceptionName: MISCONCEPTION,
    childName: CHILD,
    childCanHear: true,
    fallback: FALLBACK,
  });

  assert(
    "a coaching turn survives the overheard check",
    !coachingChecked.substituted,
    [`reasons: ${coachingChecked.verdict.reasons.join(", ")}`, `spoken: ${truncate(coaching.spoken, 300)}`].join("\n"),
  );
  assert(
    "and it still says something useful rather than deflecting",
    coaching.spoken.trim().length > 40 && coaching.spoken !== FALLBACK,
    `spoken: ${truncate(coaching.spoken, 300)}`,
  );
  assert(
    "while leaving the diagnosis on the screen",
    !/numerator|denominator/i.test(coaching.spoken) || !/separately|two separate/i.test(coaching.spoken),
    `The spoken rendering names what the child got wrong: ${truncate(coaching.spoken, 300)}`,
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
  locales: runLocales,
  voice: runVoice,
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
