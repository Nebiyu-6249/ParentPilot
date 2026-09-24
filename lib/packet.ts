import { createHash } from "node:crypto";

import { prisma, hasDatabase } from "@/lib/db";
import { demoBundle } from "@/lib/demo";
import { copy, sanitizeDeep } from "@/lib/copy";
import { messages } from "@/lib/i18n";
import { generatePacket, isConfigured, ModelError } from "@/lib/ai/provider";
import { matchMisconception, misconceptionById } from "@/lib/misconception";
import { nearestStandards, standardByCode } from "@/lib/standards";
import { verifyAnswer } from "@/lib/verify";
import { logFailure } from "@/lib/limits";
import type { PacketPayload, RegisterName } from "@/lib/ai/schemas";
import type { PacketBundle, PacketSource, ProblemView, StandardCandidate, StandardScope } from "@/lib/types";

/**
 * Capture to packet, orchestrated.
 *
 * Every step that can fail degrades to something a parent can still use:
 * no standard match still produces a packet, no model still produces the
 * cached demo, and a verification mismatch produces a packet with the answer
 * suppressed rather than no packet at all.
 */

export type PacketStep = "checking" | "matching" | "writing";


export const STEP_TEXT: Record<PacketStep, string> = {
  checking: copy.status.checking,
  matching: copy.status.matching,
  writing: copy.status.writing,
};

/**
 * The packet cache key.
 *
 * The brief specifies `standardCode:register:language`. That key is right for
 * the reusable half of a packet (primer, method comparison, scripts) but it
 * would serve one problem's `lockedAnswer`, hint ladder and isomorphs for a
 * different problem on the same standard, which is a wrong answer shown to a
 * parent behind a "Checked" badge. So the normalised problem text is folded
 * in as well.
 *
 * This keeps almost all of the intended saving, because the repeated case in
 * practice is the same problem recurring across worksheets rather than two
 * different problems sharing a standard, and it removes the possibility of
 * showing an answer that belongs to a different question.
 */
export function packetCacheKey(
  standardCode: string | null,
  register: RegisterName,
  language: string,
  printedText: string,
): string {
  const normalised = printedText.toLowerCase().replace(/\s+/g, " ").trim();
  const digest = createHash("sha1").update(normalised).digest("hex").slice(0, 12);
  return `${standardCode ?? "none"}:${register}:${language}:${digest}`;
}

function toProblemView(problem: {
  id: string;
  index: number;
  printedText: string;
  childWorkText: string | null;
  childAnswer: string | null;
  ocrConfidence: number | null;
  standardCode: string | null;
  standardSimilarity: number | null;
  expectedMethod: string | null;
  verified: boolean;
  computedAnswer: string | null;
  misconceptionId: string | null;
  status: string;
}): ProblemView {
  return {
    id: problem.id,
    index: problem.index,
    printedText: problem.printedText,
    childWorkText: problem.childWorkText,
    childAnswer: problem.childAnswer,
    ocrConfidence: problem.ocrConfidence,
    standardCode: problem.standardCode,
    standardSimilarity: problem.standardSimilarity,
    expectedMethod: problem.expectedMethod,
    verified: problem.verified,
    computedAnswer: problem.computedAnswer,
    misconceptionId: problem.misconceptionId,
    status: problem.status === "SOLVED" ? "SOLVED" : problem.status === "PARKED" ? "PARKED" : "OPEN",
  };
}

export interface BuildPacketArgs {
  problemId: string;
  register: RegisterName;
  language: string;
  grade: number | null;
  /** The child's curriculum. Null searches the whole corpus, which is what an
   *  anonymous parent gets. */
  curriculum?: string | null;
  /** The language the worksheet is written in. Null means it is the parent's. */
  schoolLanguage?: string | null;
  onStep?: (step: PacketStep) => void;
}

/**
 * The same pipeline, given the problem directly rather than by id.
 *
 * A parent who types `4 * 4` into the composer has handed over a worksheet,
 * and it should run everything a photograph runs. It cannot always be stored
 * first: an assignment needs a child profile, and a parent trying the product
 * before setting one up has none. So the row is optional. With one, this
 * behaves exactly as it did and writes the cache; without, it does the same
 * work and keeps nothing.
 */
export interface BuildFromTextArgs {
  /** A real Problem row to persist against, or null for a one-off. */
  problemId: string | null;
  printedText: string;
  childWorkText: string | null;
  childAnswer: string | null;
  register: RegisterName;
  language: string;
  grade: number | null;
  curriculum?: string | null;
  schoolLanguage?: string | null;
  onStep?: (step: PacketStep) => void;
}

/**
 * Builds the bundle for one problem, using the cache where it can.
 *
 * Returns the demo bundle with an honest banner rather than throwing, for
 * every failure a parent could plausibly hit.
 */
export async function buildPacket(args: BuildPacketArgs): Promise<PacketBundle> {
  const { problemId, register, language, onStep } = args;

  if (problemId === "demo" || !hasDatabase()) {
    // The demo carries no banner at all: it is the example, not a fallback.
    // Anything else reaching here has nowhere to be looked up, which is not
    // the same thing as a limit being hit, so it says so accurately.
    return demoBundle(register, problemId === "demo" ? null : copy.limits.demoBanner);
  }

  const problem = await prisma.problem.findUnique({ where: { id: problemId } });
  if (!problem) return demoBundle(register, copy.errors.noProblem);

  return buildPacketFromText({
    problemId: problem.id,
    printedText: problem.printedText,
    childWorkText: problem.childWorkText,
    childAnswer: problem.childAnswer,
    register,
    language,
    grade: args.grade,
    curriculum: args.curriculum ?? null,
    schoolLanguage: args.schoolLanguage ?? null,
    onStep,
  });
}

export async function buildPacketFromText(args: BuildFromTextArgs): Promise<PacketBundle> {
  const { problemId, printedText, childWorkText, childAnswer, register, language, onStep } = args;

  /* A stand-in row for the one-off case, so everything downstream sees the
     same shape whether or not this was persisted. The id is what the ask card
     sends back on "Still stuck", and `buildPacket` resolves it to the demo,
     which is the right thing: there is no stored ladder to advance. */
  const problem = {
    id: problemId ?? "typed",
    index: 0,
    printedText,
    childWorkText,
    childAnswer,
    ocrConfidence: problemId ? null : 1,
    standardCode: null as string | null,
    standardSimilarity: null as number | null,
    expectedMethod: null as string | null,
    verified: false,
    computedAnswer: null as string | null,
    misconceptionId: null as string | null,
    status: "OPEN" as const,
  };

  const grade = args.grade;

  // Step 1: recompute the arithmetic ourselves. This happens before any
  // model call, so a verification result exists even when generation fails.
  onStep?.("checking");

  // Step 2: find the standard the problem belongs to.
  onStep?.("matching");
  let standardCode = problem.standardCode;
  /* Set when the match came from outside the child's curriculum, so the
     assembled bundle can say so. A useful match from the wrong syllabus is
     worth having; a useful match from the wrong syllabus that looks like the
     right one is not. */
  let curriculumFellBack = false;

  /* The three nearest, held until generation, which picks one. Retrieval
     orders by how close the wording is; which standard a teacher files a
     problem under is a different question, and the top hit answers it usually
     rather than always. Empty when the problem already carries a code, which
     is the second view of a problem and needs no search at all. */
  let candidates: StandardCandidate[] = [];
  let similarity = problem.standardSimilarity;

  /* What the search was allowed to look at, which is what decides whether the
     chip asserts a standard or hedges it. On the anonymous path there is no
     profile and therefore no curriculum, so the search picked a syllabus as
     well as a standard and the screen has to stop short of claiming one. */
  let scope: StandardScope = {
    requested: args.curriculum ?? null,
    fellBack: false,
    mixed: false,
  };

  if (!standardCode) {
    const match = await nearestStandards(printedText, grade, 3, args.curriculum ?? null).catch(
      () => null,
    );
    candidates = match?.standards ?? [];
    curriculumFellBack = match?.fellBack ?? false;
    scope = {
      requested: args.curriculum ?? null,
      fellBack: curriculumFellBack,
      mixed: new Set(candidates.map((c) => c.curriculum)).size > 1,
    };
    // The nearest, as a provisional answer. Generation may pick another.
    standardCode = candidates[0]?.code ?? null;
    similarity = candidates[0]?.similarity ?? null;
  }
  let standard = await standardByCode(standardCode);

  let misconceptionId = problem.misconceptionId;
  if (misconceptionId === null && problem.childWorkText) {
    misconceptionId = await matchMisconception({
      printedText,
      childWorkText: problem.childWorkText,
      childAnswer: problem.childAnswer,
      standardCode,
    }).catch(() => null);

    if (misconceptionId && problemId) {
      await prisma.problem
        .update({ where: { id: problemId }, data: { misconceptionId } })
        .catch(() => undefined);
    }
  }
  const misconception = await misconceptionById(misconceptionId);

  /* The stand-in row is what `toProblemView` reads, and on the one-off path
     there is no database row to read back from, so the resolved match is
     written onto it here. Without this an anonymous parent's chip always read
     as certain, which is exactly the wrong way round: the path with no
     profile, no grade and no curriculum is the one most likely to have
     matched weakly. */
  const settle = (): void => {
    problem.standardCode = standardCode;
    problem.standardSimilarity = similarity;
  };
  settle();

  // Step 3: the packet itself, from cache if we have it.
  onStep?.("writing");
  const cacheKey = packetCacheKey(standardCode, register, language, printedText);

  const cached = await prisma.packet.findUnique({ where: { cacheKey } }).catch(() => null);
  if (cached) {
    const payload = {
      primer: cached.primer,
      methodMatch: cached.methodMatchJson,
      hintLadder: cached.hintLadderJson,
      scripts: cached.scriptsJson,
      lockedAnswer: cached.lockedAnswer,
      isomorphs: cached.isomorphsJson,
      misconceptionNote: null,
    } as unknown as PacketPayload;

    return assemble(
      problem,
      standard,
      misconception,
      payload,
      register,
      language,
      scope,
      curriculumFellBack ? curriculumNotice(args.curriculum ?? null, standard, language) : null,
      "cache",
    );
  }

  if (!isConfigured()) {
    return demoBundle(register, copy.limits.unconfiguredBanner);
  }

  const verification = verifyAnswer(printedText, null);

  let payload: PacketPayload;
  try {
    payload = await generatePacket({
      printedText,
      childWorkText: problem.childWorkText,
      childAnswer: problem.childAnswer,
      candidates,
      computedAnswer: verification.computedAnswer,
      misconception: misconception?.signature ?? misconception?.plainName ?? null,
      register,
      language,
      schoolLanguage: args.schoolLanguage ?? null,
      /* The standard the problem just retrieved against is a better source
         for the year group than any default, and when nothing matched, null
         is the truth. Neither is 4. */
      grade: grade ?? standard?.grade ?? null,
    });
  } catch (error) {
    const kind = error instanceof ModelError ? error.kind : "upstream";
    await logFailure("packet", error instanceof Error ? error.message : String(error));
    const notice = kind === "malformed" ? copy.errors.malformed : copy.errors.modelTimeout;

    // The generic primer for this standard, which is what the brief asks for
    // on a retry-exhausted model failure. It is the demo fixture when no
    // other packet for this standard exists.
    const generic = standardCode
      ? await prisma.packet
          .findFirst({ where: { cacheKey: { startsWith: `${standardCode}:${register}:${language}:` } } })
          .catch(() => null)
      : null;

    if (!generic) return demoBundle(register, notice);

    const genericPayload = {
      primer: generic.primer,
      methodMatch: generic.methodMatchJson,
      hintLadder: generic.hintLadderJson,
      scripts: generic.scriptsJson,
      lockedAnswer: generic.lockedAnswer,
      isomorphs: generic.isomorphsJson,
      misconceptionNote: null,
    } as unknown as PacketPayload;

    return assemble(
      problem, standard, misconception, genericPayload, register, language, scope, notice, "generic",
    );
  }

  /* The model's choice, checked against what it was actually offered.
     A code that is not one of the three is a hallucinated citation, and a
     citation on screen for a standard that does not exist is worse than the
     nearest match, so an unrecognised code falls back rather than being
     shown. */
  const chosen = candidates.find((c) => c.code === payload.standardCode);
  if (payload.standardCode && !chosen && candidates.length > 0) {
    await logFailure(
      "packet-standard",
      `model returned ${payload.standardCode}, which was not among ${candidates.map((c) => c.code).join(", ")}`,
    );
  }
  if (chosen) {
    standardCode = chosen.code;
    similarity = chosen.similarity;
    standard = chosen;
  }
  settle();

  /* Persisted after the choice rather than before it, so a second view of the
     same problem reads back the standard that was actually written about
     rather than the one the search happened to put first. */
  if (problemId && standardCode) {
    await prisma.problem
      .update({ where: { id: problemId }, data: { standardCode, standardSimilarity: similarity } })
      .catch(() => undefined);
  }

  // Verify the model's answer against our own arithmetic, independently.
  const checked = verifyAnswer(printedText, payload.lockedAnswer);

  /* The cache is read for both, and written only when there is a row to hang
     it on: Packet.problemId is required. A one-off pays full price and warms
     nothing, which is the honest trade for not needing a profile first. */
  if (problemId) {
    await prisma.packet
    .create({
      data: {
        problemId,
        register,
        language,
        cacheKey,
        primer: payload.primer,
        methodMatchJson: payload.methodMatch,
        hintLadderJson: payload.hintLadder,
        scriptsJson: payload.scripts,
        lockedAnswer: payload.lockedAnswer,
        isomorphsJson: payload.isomorphs,
      },
    })
    .catch(() => undefined);

    await prisma.problem
      .update({
        where: { id: problemId },
        data: { verified: checked.status === "checked", computedAnswer: checked.computedAnswer },
      })
      .catch(() => undefined);
  }

  return assemble(
    problem,
    standard,
    misconception,
    payload,
    register,
    language,
    scope,
    curriculumFellBack ? curriculumNotice(args.curriculum ?? null, standard, language) : null,
    "live",
    checked.status,
  );
}

/**
 * Says which syllabus this match came from, when it was not the child's.
 *
 * The one sentence that turns a mismatch from misleading into useful. Written
 * through the catalogue so a parent reading Arabic is told about it in Arabic,
 * and it names both curricula rather than apologising: a parent who knows the
 * match came from the Common Core can judge how much of it transfers.
 */
function curriculumNotice(
  requested: string | null,
  standard: PacketBundle["standard"],
  language: string,
): string {
  const t = messages(language);
  return t.limits.curriculumFallback
    .replace("{theirs}", requested ?? "")
    .replace("{ours}", standard?.curriculum ?? "");
}

function assemble(
  problem: Parameters<typeof toProblemView>[0],
  standard: PacketBundle["standard"],
  misconception: PacketBundle["misconception"],
  payload: PacketPayload,
  register: RegisterName,
  language: string,
  scope: StandardScope,
  notice: string | null,
  source: PacketSource,
  verification?: PacketBundle["verification"],
): PacketBundle {
  const status = verification ?? verifyAnswer(problem.printedText, payload.lockedAnswer).status;

  return {
    problem: toProblemView(problem),
    standard,
    misconception,
    packet: sanitizeDeep({
      register,
      language,
      primer: payload.primer,
      methodMatch: payload.methodMatch,
      hintLadder: payload.hintLadder,
      scripts: payload.scripts,
      // Suppressed at the source when unverified, so the answer is not merely
      // hidden by the component but absent from the payload sent to the browser.
      lockedAnswer: status === "unverified" ? "" : payload.lockedAnswer,
      isomorphs: payload.isomorphs,
      misconceptionNote: payload.misconceptionNote,
    }),
    standardScope: scope,
    notice,
    source,
    verification: status,
  };
}
