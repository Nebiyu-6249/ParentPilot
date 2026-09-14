import { NextResponse } from "next/server";
import { z } from "zod";

import { buildPacket, STEP_TEXT, type PacketStep } from "@/lib/packet";
import { cardsForChatTurn, cardsForPacket, type Card } from "@/lib/thread";
import { clientIp, consume, logFailure, validateUpload } from "@/lib/limits";
import { chatTurnLeaksAnswer } from "@/lib/answer-guard";
import { copy } from "@/lib/copy";
import { demoBundle } from "@/lib/demo";
import { chatTurn, extractWorksheet, isConfigured, ModelError } from "@/lib/ai/provider";
import { prisma, hasDatabase } from "@/lib/db";
import { toDataUrl } from "@/lib/exif";
import { currentParent, ensureParent } from "@/lib/session";
import { REGISTERS } from "@/lib/ai/schemas";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * One turn of the conversation.
 *
 * Streams NDJSON so the status line names the step the server is actually on,
 * the same contract /api/packet already uses. The final line carries the cards
 * the thread should append.
 *
 * Four kinds of turn arrive here: a photograph, the tappable demo, a tap on
 * the ladder, and free text. Only the first and the last reach a model.
 */

const bodySchema = z.object({
  kind: z.enum(["demo", "advance", "solved", "text"]),
  threadId: z.string().nullable().optional(),
  problemId: z.string().nullable().optional(),
  rung: z.number().int().min(0).max(10).optional(),
  text: z.string().max(2000).optional(),
  register: z.enum(REGISTERS).optional(),
});

type Emit = (payload: unknown) => void;

function stream(run: (send: Emit) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Emit = (payload) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        await run(send);
      } catch (error) {
        console.error("[thread] turn failed", error);
        send({ type: "cards", cards: [{ kind: "text", body: copy.errors.generic }] });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  // ---- A photograph, which is the primary input --------------------------
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("image");
    const upload = file instanceof File ? file : null;

    const valid = validateUpload(upload);
    if (!valid.ok || !upload) {
      const message =
        valid.ok || valid.reason === "missing"
          ? copy.errors.noProblem
          : valid.reason === "size"
            ? copy.capture.tooLarge
            : copy.capture.wrongType;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const bytes = new Uint8Array(await upload.arrayBuffer());
    // Metadata is stripped before the bytes leave this process. A phone photo
    // of a worksheet otherwise carries GPS coordinates.
    const dataUrl = toDataUrl(bytes, upload.type);
    const parent = await ensureParent();

    return stream(async (send) => {
      send({ type: "status", text: copy.status.reading });

      const verdict = await consume(clientIp(request.headers), "extract");
      if (!verdict.allowed || !isConfigured()) {
        const notice = !verdict.allowed
          ? verdict.reason === "spend"
            ? copy.limits.spendBanner
            : copy.limits.banner
          : copy.limits.unconfiguredBanner;
        const bundle = await demoBundle(parent.register, notice);
        send({ type: "cards", cards: cardsForPacket(bundle, dataUrl), notice });
        return;
      }

      try {
        const extraction = await extractWorksheet({
          imageDataUrl: dataUrl,
          register: parent.register,
          language: parent.language,
          grade: parent.child?.grade ?? 4,
        });

        const first = extraction.problems[0];
        if (!first) {
          send({
            type: "cards",
            cards: [{ kind: "text", body: extraction.pageNote ?? copy.errors.noProblem }],
          });
          return;
        }

        if (!hasDatabase() || !parent.child) {
          const bundle = await demoBundle(parent.register, copy.limits.demoBanner);
          send({ type: "cards", cards: cardsForPacket(bundle, dataUrl) });
          return;
        }

        const assignment = await prisma.assignment.create({
          data: {
            childId: parent.child.id,
            source: "PHOTO",
            pageUrls: [],
            problems: {
              create: extraction.problems.map((p) => ({
                index: p.index,
                printedText: p.printedText,
                childWorkText: p.childWorkText,
                childAnswer: p.childAnswer,
                ocrConfidence: p.ocrConfidence,
              })),
            },
          },
          include: { problems: { orderBy: { index: "asc" } } },
        });

        const problem = assignment.problems[0];
        if (!problem) {
          send({ type: "cards", cards: [{ kind: "text", body: copy.errors.noProblem }] });
          return;
        }

        const bundle = await buildPacket({
          problemId: problem.id,
          register: parent.register,
          language: parent.language,
          grade: parent.child.grade,
          onStep: (step: PacketStep) => send({ type: "status", text: STEP_TEXT[step] }),
        });

        send({ type: "cards", cards: cardsForPacket(bundle, dataUrl), notice: bundle.notice });
      } catch (error) {
        const kind = error instanceof ModelError ? error.kind : "upstream";
        await logFailure("thread-photo", error instanceof Error ? error.message : String(error));
        const notice = kind === "malformed" ? copy.errors.malformed : copy.errors.modelTimeout;
        const bundle = await demoBundle(parent.register, notice);
        send({ type: "cards", cards: cardsForPacket(bundle, dataUrl), notice });
      }
    });
  }

  // ---- Everything else ---------------------------------------------------
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const parent = await currentParent();
  const register = parsed.data.register ?? parent.register;

  switch (parsed.data.kind) {
    /** The tappable demo worksheet. Costs nothing and is never metered. */
    case "demo":
      return stream(async (send) => {
        const bundle = await demoBundle(register);
        send({ type: "cards", cards: cardsForPacket(bundle, null) });
      });

    /**
     * One rung of the ladder.
     *
     * No model call: the ladder was generated with the packet and is already
     * on the problem. Advancing is a read, which is why it is instant.
     */
    case "advance":
      return stream(async (send) => {
        const problemId = parsed.data.problemId ?? "demo";
        const rung = (parsed.data.rung ?? 0) + 1;

        const bundle =
          problemId === "demo" || !hasDatabase()
            ? await demoBundle(register)
            : await buildPacket({
                problemId,
                register,
                language: parent.language,
                grade: parent.child?.grade ?? null,
              });

        const ladder = bundle.packet.hintLadder;
        const at = Math.min(rung, ladder.length - 1);

        send({
          type: "cards",
          cards: [
            {
              kind: "ask",
              problemId,
              question: ladder[at] ?? "",
              rung: at,
              total: ladder.length,
            } satisfies Card,
          ],
        });
      });

    case "solved":
      return stream(async (send) => {
        const problemId = parsed.data.problemId ?? "demo";

        if (problemId !== "demo" && hasDatabase()) {
          await prisma.problem
            .update({ where: { id: problemId }, data: { status: "SOLVED" } })
            .catch(() => undefined);
        }

        const bundle =
          problemId === "demo" || !hasDatabase()
            ? await demoBundle(register)
            : await buildPacket({
                problemId,
                register,
                language: parent.language,
                grade: parent.child?.grade ?? null,
              });

        const isomorph = bundle.packet.isomorphs[0];
        send({
          type: "cards",
          cards: [
            {
              kind: "text",
              body: isomorph
                ? `${copy.packet.solvedBody} If you want one more like it: ${isomorph}`
                : copy.packet.solvedBody,
            } satisfies Card,
          ],
        });
      });

    /**
     * Something the parent typed.
     *
     * The only turn that reaches a model with free text in it, so it is the
     * only one that needs the two answer guards. The first is an absence: the
     * packet's verified answer is loaded here, used to check the reply, and
     * never passed to `chatTurn`. The second is `chatTurnLeaksAnswer`, for a
     * model that worked it out for itself.
     */
    case "text": {
      const message = parsed.data.text?.trim() ?? "";
      if (message === "") return NextResponse.json({ error: "bad request" }, { status: 400 });

      return stream(async (send) => {
        send({ type: "status", text: copy.status.thinking });

        // The problem the parent is looking at, when there is one. Typing
        // before photographing anything is legitimate ("she is already in
        // tears"), and coaching that needs no page still works.
        const problemId = parsed.data.problemId ?? null;
        const bundle =
          problemId === null
            ? null
            : problemId === "demo" || !hasDatabase()
              ? await demoBundle(register)
              : await buildPacket({
                  problemId,
                  register,
                  language: parent.language,
                  grade: parent.child?.grade ?? null,
                }).catch(() => null);

        const ladder = bundle?.packet.hintLadder ?? [];
        const rung = parsed.data.rung ?? 0;
        const rungQuestion = ladder[Math.min(rung, Math.max(ladder.length - 1, 0))] ?? null;

        const verdict = await consume(clientIp(request.headers), "packet");
        if (!verdict.allowed || !isConfigured()) {
          // Degradation is visible here for the same reason it is on the photo
          // path: a reply that looks like coaching but is a canned line would
          // be read as coaching.
          const notice = !verdict.allowed
            ? verdict.reason === "spend"
              ? copy.limits.spendBanner
              : copy.limits.banner
            : copy.chat.unavailable;
          send({
            type: "cards",
            cards: [
              { kind: "notice", body: notice } satisfies Card,
              ...(rungQuestion
                ? [
                    {
                      kind: "coach",
                      reply: copy.chat.fallbackAsk,
                      sayThis: rungQuestion,
                      watchFor: null,
                    } satisfies Card,
                  ]
                : []),
            ],
            notice,
          });
          return;
        }

        try {
          const turn = await chatTurn({
            message,
            printedText: bundle?.problem.printedText ?? null,
            childWorkText: bundle?.problem.childWorkText ?? null,
            childAnswer: bundle?.problem.childAnswer ?? null,
            misconception: bundle?.misconception?.plainName ?? null,
            rungQuestion,
            register,
            language: parent.language,
            grade: parent.child?.grade ?? bundle?.standard?.grade ?? 4,
          });

          const leaked = chatTurnLeaksAnswer(turn, bundle?.packet.lockedAnswer);
          if (leaked) {
            // Worth a ledger entry: the prompt forbids it and the model was
            // never shown the value, so this is the model computing it. If it
            // starts happening often the prompt is the thing to fix.
            await logFailure("chat-turn-answer-leak", `intent=${turn.intent}`);
          }

          send({ type: "cards", cards: cardsForChatTurn(turn, { rungQuestion, leaked }) });
        } catch (error) {
          const kind = error instanceof ModelError ? error.kind : "upstream";
          await logFailure("thread-text", error instanceof Error ? error.message : String(error));
          const notice = kind === "malformed" ? copy.errors.malformed : copy.errors.modelTimeout;
          send({ type: "cards", cards: [{ kind: "notice", body: notice } satisfies Card], notice });
        }
      });
    }

    default:
      return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
