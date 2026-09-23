import { NextResponse } from "next/server";
import { z } from "zod";

import { isConfigured, ModelError, speak, ttsVoice, voiceTurn } from "@/lib/ai/provider";
import { buildPacket } from "@/lib/packet";
import { clientIp, consume, logFailure, spendCeilingReached } from "@/lib/limits";
import { messages } from "@/lib/i18n";
import { currentParent } from "@/lib/session";
import { safeSpoken } from "@/lib/voice";
import { REGISTERS } from "@/lib/ai/schemas";

export const maxDuration = 60;
export const runtime = "nodejs";

const bodySchema = z.object({
  /* The reply already written into the thread. Bounded, and deliberately not
     trusted: everything it is checked against is read on this side. */
  writtenReply: z.string().min(1).max(4000),
  problemId: z.string().min(1).nullable().optional(),
  register: z.enum(REGISTERS).optional(),
  /** The "she can hear this" toggle. Absent means on, which is the default
   *  and the safer reading of a malformed request. */
  childCanHear: z.boolean().optional(),
});

/**
 * The only place in this product that turns text into speech in a room.
 *
 * One chokepoint, on the server, and every fact the safety check runs against
 * is looked up here rather than accepted from the request. A client that
 * posts `writtenReply: "it comes to 11/12"` gets the fallback line read back
 * to it, because the computed answer is fetched from the problem and
 * `safeSpoken` compares against that.
 *
 * The order matters and is the point of the file:
 *
 *   1. Look up the problem's own facts: the computed answer, the
 *      misconception, the child's name.
 *   2. Ask the model for a spoken rendering.
 *   3. Check it. On any failure, substitute the fixed line.
 *   4. Only then synthesise.
 *
 * Synthesis is the last irreversible step. Once it is audio it is in the air,
 * and there is no equivalent of not rendering a card.
 */
export async function POST(request: Request): Promise<Response> {
  const parent = await currentParent();
  const t = messages(parent.language);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const register = parsed.data.register ?? parent.register;
  const childCanHear = parsed.data.childCanHear ?? true;

  if (!isConfigured()) return NextResponse.json({ error: t.voice.unconfigured }, { status: 503 });
  if (await spendCeilingReached()) return NextResponse.json({ error: t.voice.limit }, { status: 503 });

  const verdict = await consume(clientIp(request.headers), "packet");
  if (!verdict.allowed) return NextResponse.json({ error: t.voice.limit }, { status: 503 });

  /* The problem's facts, from this side. `buildPacket` reads the cache and
     does not regenerate, so this costs nothing when the thread already has a
     packet, which by this point it always does. */
  const bundle = parsed.data.problemId
    ? await buildPacket({
        problemId: parsed.data.problemId,
        register,
        language: parent.language,
        grade: parent.child?.grade ?? null,
        curriculum: parent.child?.curriculum ?? null,
        schoolLanguage: parent.child?.schoolLanguage ?? null,
      }).catch(() => null)
    : null;

  const computedAnswer = bundle?.problem.computedAnswer ?? null;
  const misconceptionName = bundle?.misconception?.plainName ?? null;

  let rendering: string;
  try {
    const turn = await voiceTurn({
      writtenReply: parsed.data.writtenReply,
      printedText: bundle?.problem.printedText ?? null,
      misconception: misconceptionName,
      childName: parent.child?.firstName ?? null,
      childCanHear,
      register,
      language: parent.language,
      schoolLanguage: parent.child?.schoolLanguage ?? null,
    });
    rendering = turn.spoken;
  } catch (error) {
    const kind = error instanceof ModelError ? error.kind : "upstream";
    await logFailure("voice-turn", error instanceof Error ? error.message : String(error));
    /* A failed rendering is not a reason to read the written reply aloud.
       The written one is franker by design and may name the misconception,
       so the degraded path is the fixed line, not the fallback of last
       resort being the least safe text in the request. */
    rendering = t.voice.onScreen;
    void kind;
  }

  const checked = safeSpoken({
    spoken: rendering,
    computedAnswer,
    misconceptionName,
    childName: parent.child?.firstName ?? null,
    childCanHear,
    fallback: t.voice.onScreen,
  });

  if (checked.substituted) {
    /* Logged rather than swallowed. A rendering that had to be replaced is
       the prompt failing at the one thing it exists for, and it should show
       up on /ops/doctor rather than only in a parent's ears. */
    await logFailure("voice-unsafe", `substituted: ${checked.verdict.reasons.join(", ")}`);
  }

  try {
    const voice = ttsVoice(parent.language);
    const audio = await speak(checked.text, voice);

    return new Response(Uint8Array.from(audio.bytes), {
      headers: {
        "content-type": audio.mimeType,
        // Never cached. A spoken reply belongs to one turn in one kitchen.
        "cache-control": "no-store",
        "x-pp-voice": voice,
        "x-pp-voice-checked": checked.substituted ? checked.verdict.reasons.join(",") : "ok",
      },
    });
  } catch (error) {
    await logFailure("voice-speak", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: t.voice.failed }, { status: 502 });
  }
}
