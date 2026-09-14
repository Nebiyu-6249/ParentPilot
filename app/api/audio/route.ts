import { NextResponse } from "next/server";
import { z } from "zod";

import { isConfigured, speakPrimer, ttsVoice } from "@/lib/ai/provider";
import { clientIp, consume, logFailure, spendCeilingReached } from "@/lib/limits";
import { prisma, hasDatabase } from "@/lib/db";
import { demoBundle } from "@/lib/demo";
import { packetCacheKey } from "@/lib/packet";
import { currentParent } from "@/lib/session";
import { REGISTERS } from "@/lib/ai/schemas";

export const maxDuration = 60;
export const runtime = "nodejs";

const querySchema = z.object({
  problemId: z.string().min(1),
  register: z.enum(REGISTERS).optional(),
});

/**
 * The primer, read aloud.
 *
 * Cached on the same key as the packet it reads, so a primer is spoken once
 * per standard, register and language rather than once per listen. The second
 * parent to open the same worksheet at the same register pays nothing.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    problemId: url.searchParams.get("problemId") ?? "",
    register: url.searchParams.get("register") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const parent = await currentParent();
  const register = parsed.data.register ?? parent.register;
  const language = parent.language;

  // Work out the text and the cache key the same way the packet did.
  let primer: string;
  let cacheKey: string;

  if (parsed.data.problemId === "demo" || !hasDatabase()) {
    const demo = await demoBundle(register);
    primer = demo.packet.primer;
    cacheKey = packetCacheKey(demo.standard?.code ?? null, register, language, demo.problem.printedText);
  } else {
    const problem = await prisma.problem
      .findUnique({ where: { id: parsed.data.problemId } })
      .catch(() => null);
    if (!problem) return NextResponse.json({ error: "not found" }, { status: 404 });

    cacheKey = packetCacheKey(problem.standardCode, register, language, problem.printedText);
    const packet = await prisma.packet.findUnique({ where: { cacheKey } }).catch(() => null);
    if (!packet) return NextResponse.json({ error: "no packet yet" }, { status: 409 });
    primer = packet.primer;
  }

  const audioKey = `${cacheKey}:${ttsVoice()}`;

  if (hasDatabase()) {
    const cached = await prisma.audioPrimer.findUnique({ where: { cacheKey: audioKey } }).catch(() => null);
    if (cached) {
      return new Response(Uint8Array.from(cached.bytes), {
        headers: {
          "content-type": cached.mimeType,
          "cache-control": "private, max-age=86400",
          "x-pp-audio": "cache",
        },
      });
    }
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: "audio unavailable" }, { status: 503 });
  }

  // Speech is metered and costed like every other model call.
  if (await spendCeilingReached()) {
    return NextResponse.json({ error: "spend ceiling reached" }, { status: 503 });
  }
  const verdict = await consume(clientIp(request.headers), "packet");
  if (!verdict.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 503 });
  }

  try {
    const spoken = await speakPrimer(primer, ttsVoice());

    if (hasDatabase()) {
      await prisma.audioPrimer
        .create({
          data: {
            cacheKey: audioKey,
            voice: ttsVoice(),
            mimeType: spoken.mimeType,
            bytes: spoken.bytes,
            // A rough duration for the UI, at a typical reading pace.
            seconds: Math.round(spoken.characters / 14),
          },
        })
        .catch(() => undefined);
    }

    return new Response(spoken.bytes, {
      headers: {
        "content-type": spoken.mimeType,
        "cache-control": "private, max-age=86400",
        "x-pp-audio": "generated",
      },
    });
  } catch (error) {
    await logFailure("audio", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "audio failed" }, { status: 502 });
  }
}
