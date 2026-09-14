import { NextResponse } from "next/server";
import { z } from "zod";

import { buildPacket, STEP_TEXT, type PacketStep } from "@/lib/packet";
import { clientIp, consume } from "@/lib/limits";
import { copy } from "@/lib/copy";
import { demoBundle } from "@/lib/demo";
import { currentParent } from "@/lib/session";
import { REGISTERS } from "@/lib/ai/schemas";

/** Packet generation can take most of half a minute. Vercel needs telling. */
export const maxDuration = 60;
export const runtime = "nodejs";

const bodySchema = z.object({
  problemId: z.string().min(1),
  register: z.enum(REGISTERS).optional(),
  language: z.string().min(2).max(12).optional(),
});

/**
 * Streams NDJSON: one `status` line per pipeline step, then one `bundle`.
 *
 * Streaming rather than a timed client-side animation, so the status line a
 * parent reads names the step the server is actually on. A client that does
 * not care about progress (the register control, for instance) just reads to
 * the end and takes the last line.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const parent = await currentParent();
  const register = parsed.data.register ?? parent.register;
  const language = parsed.data.language ?? parent.language;

  // The demo fixture costs nothing, so it is never metered. This is what
  // makes the landing page "Try it" button immune to traffic.
  if (parsed.data.problemId !== "demo") {
    const verdict = await consume(clientIp(request.headers), "packet");
    if (!verdict.allowed) {
      const notice = verdict.reason === "spend" ? copy.limits.spendBanner : copy.limits.banner;
      return NextResponse.json(await demoBundle(register, notice));
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown): void => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const bundle = await buildPacket({
          problemId: parsed.data.problemId,
          register,
          language,
          grade: parent.child?.grade ?? null,
          onStep: (step: PacketStep) => send({ type: "status", step, text: STEP_TEXT[step] }),
        });
        send({ type: "bundle", bundle });
      } catch (error) {
        console.error("[api/packet] failed", error);
        // Never an error page. A working saved example with an honest banner.
        send({ type: "bundle", bundle: await demoBundle(register, copy.errors.generic) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
