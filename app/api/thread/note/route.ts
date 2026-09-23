import { NextResponse } from "next/server";
import { z } from "zod";

import { clientIp, consume, logFailure } from "@/lib/limits";
import { currentParent } from "@/lib/session";
import { demoBundle } from "@/lib/demo";
import { generateTeacherNote, isConfigured } from "@/lib/ai/provider";
import { prisma, hasDatabase } from "@/lib/db";
import { misconceptionById } from "@/lib/misconception";
import { standardByCode } from "@/lib/standards";
import { REGISTERS } from "@/lib/ai/schemas";
import { messages } from "@/lib/i18n";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Drafts the note a parent sends their child's teacher about this thread.
 *
 * This is what the Share button in the thread's top bar opens. It is the only
 * outward-facing thing a thread produces, and it is deliberately the smallest
 * one: a draft the parent reads, edits and sends under their own name. Nothing
 * is sent from here and the draft is not stored, so there is no path from a
 * thread to anything a teacher can open without the parent choosing to.
 *
 * The note describes where the homework got to. It cannot describe the answer:
 * `TeacherNoteArgs` has no field for one and the prompt is never given one, so
 * the press-and-hold is not defeated by a parent forwarding a note.
 */

const bodySchema = z.object({
  problemId: z.string().min(1).max(200),
  register: z.enum(REGISTERS).optional(),
});

export async function POST(request: Request): Promise<Response> {
  /* Every notice below is rendered in the parent's thread, so it is written in
     the parent's language rather than in the server's. Read before the
     validation branches, because those branches produce notices too. */
  const parent = await currentParent();
  const t = messages(parent.language);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: t.chat.shareEmpty }, { status: 400 });
  }

  const register = parsed.data.register ?? parent.register;
  const { problemId } = parsed.data;

  // Metered like every other model path, and refused into a message rather
  // than a status code, because this opens inside a dialog the parent is
  // already looking at. Which refusal it was decides which sentence: a
  // deployment with no key and a deployment over its ceiling are different
  // situations and only one of them is worth retrying.
  if (!isConfigured()) {
    return NextResponse.json({ ok: false, message: t.chat.shareUnconfigured });
  }

  const verdict = await consume(clientIp(request.headers), "packet");
  if (!verdict.allowed) {
    return NextResponse.json({ ok: false, message: t.chat.shareLimit });
  }

  try {
    const facts = await problemFacts(problemId, register);
    if (!facts) {
      return NextResponse.json({ ok: false, message: t.chat.shareEmpty }, { status: 404 });
    }

    const note = await generateTeacherNote({
      childName: parent.child?.firstName ?? null,
      printedText: facts.printedText,
      standardPlain: facts.standardPlain,
      // A thread is not timed, so there is no duration to report and none is
      // invented. The prompt drops the "we spent this long" beat when this is
      // null. A plausible number in a note a parent sends their child's
      // teacher under their own name is a fabrication, not a default.
      minutes: null,
      misconception: facts.misconception,
      register,
      language: parent.language,
    });

    return NextResponse.json({ ok: true, note });
  } catch (error) {
    await logFailure("thread-note", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, message: t.chat.shareFailed });
  }
}

interface ProblemFacts {
  printedText: string;
  standardPlain: string | null;
  misconception: string | null;
}

/**
 * The facts the note is written from, for a real problem or for the demo.
 *
 * The demo has to work here for the same reason it works everywhere else: a
 * parent deciding whether to trust this with a photograph of their child's
 * work should be able to see the whole loop first, and the teacher note is
 * part of the loop.
 */
async function problemFacts(problemId: string, register: (typeof REGISTERS)[number]): Promise<ProblemFacts | null> {
  if (problemId === "demo" || !hasDatabase()) {
    const bundle = await demoBundle(register);
    return {
      printedText: bundle.problem.printedText,
      standardPlain: bundle.standard?.plainLanguage ?? null,
      misconception: bundle.misconception?.signature ?? null,
    };
  }

  const problem = await prisma.problem.findUnique({ where: { id: problemId } }).catch(() => null);
  if (!problem) return null;

  const [standard, misconception] = await Promise.all([
    standardByCode(problem.standardCode),
    misconceptionById(problem.misconceptionId),
  ]);

  return {
    printedText: problem.printedText,
    standardPlain: standard?.plainLanguage ?? null,
    misconception: misconception?.signature ?? misconception?.plainName ?? null,
  };
}
