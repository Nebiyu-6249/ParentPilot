import { NextResponse } from "next/server";

import { generateRecap, generateTeacherNote, isConfigured } from "@/lib/ai/provider";
import { autonomyReading, autonomyScore, countMoves } from "@/lib/autonomy";
import { logFailure } from "@/lib/limits";
import { prisma, hasDatabase } from "@/lib/db";
import { currentParent } from "@/lib/session";
import type { MoveLabelName } from "@/lib/ai/schemas";
import { messages } from "@/lib/i18n";

export const maxDuration = 45;
export const runtime = "nodejs";

export interface EndSessionResponse {
  autonomyScore: number;
  reading: string;
  moveCounts: Record<string, number>;
  recap: string | null;
  oneThingToTry: string | null;
  teacherNote: string | null;
  parked: boolean;
}

/**
 * Ends a Live Mode session and computes the recap.
 *
 * The recap is written from move counts alone. There is no transcript to
 * write it from, which is the point: the model that writes a parent's recap
 * has never seen a word their child said.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  /* Every notice below is rendered in the parent's thread, so it is written in
     the parent's language rather than in the server's. Read before the
     validation branches, because those branches produce notices too. */
  const parent = await currentParent();
  const t = messages(parent.language);

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { parked?: boolean } | null;

  if (!hasDatabase()) {
    return NextResponse.json({
      autonomyScore: 0,
      reading: autonomyReading(0),
      moveCounts: {},
      recap: null,
      oneThingToTry: null,
      teacherNote: null,
      parked: Boolean(body?.parked),
    } satisfies EndSessionResponse);
  }

  const session = await prisma.session
    .findUnique({ where: { id }, include: { moves: true, child: true } })
    .catch(() => null);

  if (!session) return NextResponse.json({ error: t.errors.notFound }, { status: 404 });

  const labels = session.moves.map((m) => m.label as MoveLabelName);
  const counts = countMoves(labels);
  const score = autonomyScore(counts);
  const parked = Boolean(body?.parked) || session.parked;

  const endedAt = new Date();
  const durationMinutes = Math.max(
    1,
    Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000),
  );

  await prisma.session
    .update({
      where: { id },
      data: {
        endedAt,
        autonomyScore: score,
        moveCountsJson: counts as Record<string, number>,
        parked,
      },
    })
    .catch(() => undefined);


  let recap: string | null = null;
  let oneThingToTry: string | null = null;
  let teacherNote: string | null = null;

  if (isConfigured()) {
    try {
      const result = await generateRecap({
        moveCounts: counts as Record<string, number>,
        autonomyScore: score,
        durationMinutes,
        parked,
        register: parent.register,
        language: parent.language,
      });
      recap = result.recap;
      oneThingToTry = result.oneThingToTry;
    } catch (error) {
      await logFailure("recap", error instanceof Error ? error.message : String(error));
    }

    if (parked) {
      try {
        const problem = await prisma.problem.findFirst({
          where: { assignment: { childId: session.childId } },
          orderBy: { id: "desc" },
        });

        teacherNote = await generateTeacherNote({
          childName: session.child.firstName,
          printedText: problem?.printedText ?? "the homework set for tonight",
          standardPlain: null,
          minutes: durationMinutes,
          misconception: null,
          register: parent.register,
          language: parent.language,
        });
      } catch (error) {
        await logFailure("teacher-note", error instanceof Error ? error.message : String(error));
      }
    }
  }

  return NextResponse.json({
    autonomyScore: score,
    reading: autonomyReading(score),
    moveCounts: counts as Record<string, number>,
    recap,
    oneThingToTry,
    teacherNote,
    parked,
  } satisfies EndSessionResponse);
}
