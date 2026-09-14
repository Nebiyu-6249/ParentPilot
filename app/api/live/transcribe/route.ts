import { NextResponse } from "next/server";

import { isConfigured, transcribeChunk } from "@/lib/ai/provider";
import { clientIp, consume, logFailure } from "@/lib/limits";

export const maxDuration = 30;
export const runtime = "nodejs";

/** Roughly the length of one chunk, in seconds, for metering. */
const CHUNK_SECONDS = 3;
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * Fallback transcription for browsers without the Web Speech API.
 *
 * The audio is transcribed and dropped. It is not written to disk, not
 * written to the database, and not retained after this request returns. The
 * primary path never sends audio anywhere at all: Chrome and Safari do the
 * recognition in the browser, which is both free and the stronger privacy
 * position, so this route exists only for the browsers that cannot.
 */
export async function POST(request: Request): Promise<Response> {
  const verdict = await consume(clientIp(request.headers), "transcribe", CHUNK_SECONDS);
  if (!verdict.allowed || !isConfigured()) {
    return NextResponse.json({ text: "", limited: true });
  }

  const form = await request.formData().catch(() => null);
  const chunk = form?.get("audio");
  if (!(chunk instanceof File) || chunk.size === 0 || chunk.size > MAX_CHUNK_BYTES) {
    return NextResponse.json({ text: "" });
  }

  try {
    const text = await transcribeChunk(chunk);
    return NextResponse.json({ text });
  } catch (error) {
    await logFailure("transcribe", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ text: "" });
  }
}
