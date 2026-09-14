import { NextResponse } from "next/server";
import { z } from "zod";

import { classifyMove, isConfigured } from "@/lib/ai/provider";
import { clientIp, consume, logFailure } from "@/lib/limits";
import { prisma, hasDatabase } from "@/lib/db";
import { currentParent } from "@/lib/session";
import { evaluateMove, shouldLogMove, type LiveState } from "@/lib/live/rules";
import type { MoveLabelName } from "@/lib/ai/schemas";
import { MOVE_LABELS } from "@/lib/ai/schemas";

export const maxDuration = 30;
export const runtime = "nodejs";

const stateSchema = z.object({
  cardsShown: z.number().int().min(0),
  lastCardAt: z.number().nullable(),
  escalationsAt: z.array(z.number()),
  parked: z.boolean(),
});

const bodySchema = z.object({
  /** The rolling 30 second window. Held in memory on the client, never stored here. */
  window: z.string().max(4000),
  tOffset: z.number().int().min(0),
  sessionId: z.string().nullable(),
  state: stateSchema,
});

export interface ClassifyResponse {
  label: MoveLabelName;
  confidence: number;
  card: { id: string; triggerLabel: MoveLabelName; text: string; tOffset: number } | null;
  park: { reason: "time" | "escalation" } | null;
  state: LiveState;
}

/**
 * Classifies one window and decides whether to interrupt.
 *
 * The window arrives, is classified, and is discarded when this function
 * returns. Only the label, the confidence and the timestamp are written to
 * the database. There is no column to put the words in, by design: see the
 * `Move` model in prisma/schema.prisma.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { window, tOffset, sessionId, state } = parsed.data;
  const parent = await currentParent();

  const quiet = (label: MoveLabelName): Response =>
    NextResponse.json({ label, confidence: 0, card: null, park: null, state } satisfies ClassifyResponse);

  if (!window.trim()) return quiet("PRODUCTIVE_WAIT");

  const verdict = await consume(clientIp(request.headers), "packet");
  if (!verdict.allowed || !isConfigured()) return quiet("NEUTRAL");

  let label: MoveLabelName;
  let confidence: number;
  try {
    const result = await classifyMove({
      window,
      register: parent.register,
      language: parent.language,
    });
    label = result.label;
    confidence = result.confidence;
  } catch (error) {
    await logFailure("classify", error instanceof Error ? error.message : String(error));
    return quiet("NEUTRAL");
  }

  if (!MOVE_LABELS.includes(label)) return quiet("NEUTRAL");

  const outcome = evaluateMove({
    label,
    confidence,
    tOffset,
    anxietyBand: parent.anxietyBand,
    state,
  });

  let cardId = "local";

  if (sessionId && hasDatabase()) {
    try {
      if (shouldLogMove(label)) {
        await prisma.move.create({ data: { sessionId, tOffset, label, confidence } });
      }
      if (outcome.card) {
        const row = await prisma.card.create({
          data: {
            sessionId,
            tOffset: outcome.card.tOffset,
            triggerLabel: outcome.card.triggerLabel,
            text: outcome.card.text,
          },
        });
        cardId = row.id;
      }
      if (outcome.park) {
        await prisma.session.update({ where: { id: sessionId }, data: { parked: true } });
      }
    } catch (error) {
      await logFailure("classify-persist", error instanceof Error ? error.message : String(error));
    }
  }

  return NextResponse.json({
    label,
    confidence,
    card: outcome.card ? { id: cardId, ...outcome.card } : null,
    park: outcome.park,
    state: outcome.state,
  } satisfies ClassifyResponse);
}
