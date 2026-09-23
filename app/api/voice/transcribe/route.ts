import { NextResponse } from "next/server";

import { isConfigured, transcribeChunk } from "@/lib/ai/provider";
import { clientIp, consume, logFailure } from "@/lib/limits";
import { messages } from "@/lib/i18n";
import { currentParent } from "@/lib/session";

export const maxDuration = 45;
export const runtime = "nodejs";

/** One press and hold. Longer than this is a speech, not a question. */
const MAX_SECONDS = 30;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * One spoken utterance, transcribed.
 *
 * Separate from `/api/live/transcribe` on purpose, and the difference is a
 * promise rather than a parameter.
 *
 * Live Mode's audio normally never leaves the browser at all: Chrome and
 * Safari do the recognition in the page, and that route exists only for the
 * browsers that cannot. Voice Mode's audio always leaves the browser, because
 * press and hold has no in-page equivalent that works everywhere. Those are
 * different privacy positions and they are stated separately rather than
 * hidden behind a shared handler with a flag.
 *
 * What is the same: the audio is transcribed and dropped. It is not written
 * to disk, not written to the database, and not retained after this request
 * returns. There is no column it could go in.
 */
export async function POST(request: Request): Promise<Response> {
  const t = messages((await currentParent()).language);

  const verdict = await consume(clientIp(request.headers), "transcribe", MAX_SECONDS);
  if (!verdict.allowed) {
    return NextResponse.json({ text: "", error: t.voice.limit });
  }
  if (!isConfigured()) {
    return NextResponse.json({ text: "", error: t.voice.unconfigured });
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ text: "", error: t.voice.nothingHeard });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ text: "", error: t.voice.tooLong });
  }

  try {
    const text = (await transcribeChunk(audio)).trim();
    // Whisper returns an empty string, or a stray "you", for silence. Either
    // way there is no question here and saying so beats sending it on.
    if (text.length < 2) return NextResponse.json({ text: "", error: t.voice.nothingHeard });
    return NextResponse.json({ text });
  } catch (error) {
    await logFailure("voice-transcribe", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ text: "", error: t.voice.failed });
  }
}
