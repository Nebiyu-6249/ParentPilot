import { createHash } from "node:crypto";

import { prisma, hasDatabase } from "@/lib/db";
import { demoBundle } from "@/lib/demo";
import { copy, sanitizeDeep } from "@/lib/copy";
import { generatePacket, isConfigured, ModelError } from "@/lib/ai/provider";
import { matchMisconception, misconceptionById } from "@/lib/misconception";
import { nearestStandards, standardByCode } from "@/lib/standards";
import { verifyAnswer } from "@/lib/verify";
import { logFailure } from "@/lib/limits";
import type { PacketPayload, RegisterName } from "@/lib/ai/schemas";
import type { PacketBundle, PacketSource, ProblemView } from "@/lib/types";

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

  const grade = args.grade;

  // Step 1: recompute the arithmetic ourselves. This happens before any
  // model call, so a verification result exists even when generation fails.
  onStep?.("checking");
  const printedText = problem.printedText;

  // Step 2: find the standard the problem belongs to.
  onStep?.("matching");
  let standardCode = problem.standardCode;
  if (!standardCode) {
    const matches = await nearestStandards(printedText, grade, 1).catch(() => []);
    standardCode = matches[0]?.code ?? null;
    if (standardCode) {
      await prisma.problem
        .update({ where: { id: problem.id }, data: { standardCode } })
        .catch(() => undefined);
    }
  }
  const standard = await standardByCode(standardCode);

  let misconceptionId = problem.misconceptionId;
  if (misconceptionId === null && problem.childWorkText) {
    misconceptionId = await matchMisconception({
      printedText,
      childWorkText: problem.childWorkText,
      childAnswer: problem.childAnswer,
      standardCode,
    }).catch(() => null);

    if (misconceptionId) {
      await prisma.problem
        .update({ where: { id: problem.id }, data: { misconceptionId } })
        .catch(() => undefined);
    }
  }
  const misconception = await misconceptionById(misconceptionId);

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

    return assemble(problem, standard, misconception, payload, register, language, null, "cache");
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
      standardCode,
      standardPlain: standard?.plainLanguage ?? null,
      expectedMethods: standard?.expectedMethods ?? [],
      parentMethod: standard?.parentMethod ?? null,
      computedAnswer: verification.computedAnswer,
      misconception: misconception?.signature ?? misconception?.plainName ?? null,
      register,
      language,
      grade: grade ?? standard?.grade ?? 4,
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

    return assemble(problem, standard, misconception, genericPayload, register, language, notice, "generic");
  }

  // Verify the model's answer against our own arithmetic, independently.
  const checked = verifyAnswer(printedText, payload.lockedAnswer);

  await prisma.packet
    .create({
      data: {
        problemId: problem.id,
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
      where: { id: problem.id },
      data: { verified: checked.status === "checked", computedAnswer: checked.computedAnswer },
    })
    .catch(() => undefined);

  return assemble(problem, standard, misconception, payload, register, language, null, "live", checked.status);
}

function assemble(
  problem: Parameters<typeof toProblemView>[0],
  standard: PacketBundle["standard"],
  misconception: PacketBundle["misconception"],
  payload: PacketPayload,
  register: RegisterName,
  language: string,
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
    notice,
    source,
    verification: status,
  };
}
