import { NextResponse } from "next/server";
import { z } from "zod";

import { buildPacket, buildPacketFromText, STEP_TEXT, type PacketStep } from "@/lib/packet";
import {
  cardsForPacket,
  resolveIntent,
  revealsAnswer,
  TRANSCRIPT_LINES,
  type Card,
  type ThreadLine,
} from "@/lib/thread";
import { clientIp, consume, logFailure, validateUpload } from "@/lib/limits";
import { copy } from "@/lib/copy";
import { demoBundle } from "@/lib/demo";
import { chatTurn, extractWorksheet, isConfigured, ModelError } from "@/lib/ai/provider";
import { prisma, hasDatabase } from "@/lib/db";
import { toDataUrl } from "@/lib/exif";
import { currentParent, ensureParent } from "@/lib/session";
import type { ChatIntent } from "@/lib/ai/schemas";
import type { PacketBundle } from "@/lib/types";
import { REGISTERS } from "@/lib/ai/schemas";
import { looksLikeProblem, verifyAnswer } from "@/lib/verify";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * One turn of the conversation.
 *
 * Streams NDJSON so the status line names the step the server is actually on,
 * the same contract /api/packet already uses. The final line carries the cards
 * the thread should append.
 *
 * Four kinds of turn: a photograph, the demo, a rung of the ladder, and free
 * text. The first three need no model beyond the packet they already have.
 * Free text is the only one that calls a model per message, and it is the most
 * constrained call in the product.
 */

const bodySchema = z.object({
  kind: z.enum(["demo", "advance", "solved", "text"]),
  threadId: z.string().nullable().optional(),
  problemId: z.string().nullable().optional(),
  rung: z.number().int().min(0).max(10).optional(),
  text: z.string().max(2000).optional(),
  register: z.enum(REGISTERS).optional(),
  /* The problem a one-off turn is about. A typed problem is not always stored,
     because an assignment needs a child profile, so "Still stuck" has to be
     able to say which problem it means. No new exposure: this is text the
     parent typed in the first place. */
  printedText: z.string().max(600).optional(),
  /* What was said, from the client, bounded on both axes. Every fact about
     the problem is read from the database on this side instead, so the worst
     a tampered transcript can do is confuse the reply it gets back. */
  transcript: z
    .array(
      z.object({
        role: z.enum(["PARENT", "ASSISTANT"]),
        text: z.string().max(1200),
      }),
    )
    .max(TRANSCRIPT_LINES)
    .optional(),
});

type Emit = (payload: unknown) => void;

/** Phrasing the prompt bans. Seeing it means the prompt is losing. */
const HELP_DESK = [
  "this tool",
  "this product",
  "this app",
  "i can't assist",
  "i cannot assist",
  "i am unable to",
  "feel free to",
  "as an ai",
];

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

        const bundle = await bundleFor(problemId, parsed.data.printedText, register, parent);

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

        const bundle = await bundleFor(problemId, parsed.data.printedText, register, parent);

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
     * A parent typing.
     *
     * The one place a model writes prose into the thread, so it is the one
     * place the product's whole claim can be talked out of. Three things hold
     * it: the prompt, an intent that is separate from the prose, and the
     * answer being emitted by this route from the packet rather than written
     * by the model at all.
     */
    case "text":
      return stream(async (send) => {
        const said = (parsed.data.text ?? "").trim();
        if (!said) {
          send({ type: "cards", cards: [{ kind: "text", body: copy.chat.turnFailed }] });
          return;
        }

        if (!isConfigured()) {
          send({ type: "cards", cards: [{ kind: "text", body: copy.chat.turnUnconfigured }] });
          return;
        }

        const verdict = await consume(clientIp(request.headers), "packet");
        if (!verdict.allowed) {
          send({ type: "cards", cards: [{ kind: "text", body: copy.chat.turnLimit }] });
          return;
        }

        /* A typed problem is a worksheet that arrived through the composer,
           so it runs the pipeline a photograph runs rather than being read as
           conversation. "4 * 4" used to come back as "here is the next one to
           try", which is an answer to a question nobody asked. */
        const typed = looksLikeProblem(said);
        if (typed) {
          const owner = await ensureParent();
          const rowId =
            hasDatabase() && owner.child
              ? await prisma.assignment
                  .create({
                    data: {
                      childId: owner.child.id,
                      source: "TEXT",
                      pageUrls: [],
                      problems: { create: [{ index: 0, printedText: typed, ocrConfidence: 1 }] },
                    },
                    include: { problems: true },
                  })
                  .then((a) => a.problems[0]?.id ?? null)
                  .catch(() => null)
              : null;

          const bundle = await buildPacketFromText({
            problemId: rowId,
            printedText: typed,
            // Typed problems carry no working, so there is nothing to
            // diagnose and `cardsForPacket` emits no misconception card.
            childWorkText: null,
            childAnswer: null,
            register,
            language: owner.language,
            grade: owner.child?.grade ?? null,
            onStep: (step: PacketStep) => send({ type: "status", text: STEP_TEXT[step] }),
          });

          send({ type: "cards", cards: cardsForPacket(bundle, null), notice: bundle.notice });
          return;
        }

        const problemId = parsed.data.problemId ?? null;
        send({ type: "status", text: copy.status.thinking });

        // Every fact below comes from this side. The request carries what was
        // said and nothing else.
        const bundle = problemId
          ? await buildPacket({
              problemId,
              register,
              language: parent.language,
              grade: parent.child?.grade ?? null,
            }).catch(() => null)
          : null;

        const ladder = bundle?.packet.hintLadder ?? [];
        const rung = parsed.data.rung ?? 0;

        let turn;
        try {
          turn = await chatTurn({
            childName: parent.child?.firstName ?? null,
            printedText: bundle?.problem.printedText ?? null,
            childWorkText: bundle?.problem.childWorkText ?? null,
            standardPlain: bundle?.standard?.plainLanguage ?? null,
            misconception: bundle?.misconception?.plainName ?? null,
            rungsUsed: Math.min(rung + 1, ladder.length),
            rungsTotal: ladder.length,
            transcript: renderTranscript(parsed.data.transcript ?? [], said),
            register,
            language: parent.language,
          });
        } catch (error) {
          await logFailure("thread-text", error instanceof Error ? error.message : String(error));
          send({ type: "cards", cards: [{ kind: "text", body: copy.chat.turnFailed }] });
          return;
        }

        /* The guarantee, not the request. The prompt forbids stating the
           answer; this decides it. A reply with the answer in it is replaced
           rather than edited, because a sentence with the answer cut out of it
           no longer means anything. */
        const computed = bundle ? verifyAnswer(bundle.problem.printedText, null).computedAnswer : null;
        const leaked = revealsAnswer(turn.reply, computed);
        const reply = leaked ? copy.chat.answerBehindHold : turn.reply;
        if (leaked) await logFailure("thread-text", "A reply named the answer and was replaced.");

        /* Logged, not rewritten. "this tool" and "I can't assist with" are the
           voice this prompt exists to get rid of, and a reply carrying one is
           worth seeing on /ops; editing the sentence around it would leave
           something worse than what the model wrote. */
        const helpDesk = HELP_DESK.filter((phrase) => reply.toLowerCase().includes(phrase));
        if (helpDesk.length > 0) {
          await logFailure("thread-text", `A reply used help desk phrasing: ${helpDesk.join(", ")}`);
        }

        /* The press and hold is for the problem in front of the child, and
           `resolveIntent` is the last word on whether it is offered. A
           classifier that reaches for it on a definition, an example or a
           bare "what" has misread the question, and those are exactly the
           lines that broke. */
        const intent: ChatIntent = resolveIntent(said, turn.intent, bundle !== null);

        const cards: Card[] = [{ kind: "text", body: reply, intent }];

        if (intent === "answer" && bundle) {
          // Written here, from the packet, and never by the model.
          cards.push({
            kind: "answer",
            answer: bundle.packet.lockedAnswer,
            verification: bundle.verification,
          });
        }

        if (intent === "next_question" && ladder.length > 0 && problemId) {
          const at = Math.min(rung + 1, ladder.length - 1);
          cards.push({ kind: "ask", problemId, question: ladder[at] ?? "", rung: at, total: ladder.length });
        }

        send({ type: "cards", cards });
      });

    default:
      return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}

/**
 * The conversation, as the model is shown it.
 *
 * Labelled by speaker so the model can tell what it already said from what the
 * parent said, and capped so a long evening cannot grow the prompt without
 * bound. The parent's newest line is appended here rather than trusted from
 * the array, so it is always last and always present.
 */
function renderTranscript(lines: ThreadLine[], said: string): string {
  const rendered = lines
    .slice(-TRANSCRIPT_LINES)
    .map((line) => `${line.role === "PARENT" ? "Parent" : "ParentPilot"}: ${line.text}`);

  rendered.push(`Parent: ${said}`);
  return rendered.join("\n");
}

/**
 * The packet a follow-up turn is about.
 *
 * Three cases. A stored problem is looked up. The demo is the fixture. A
 * one-off typed problem has no row, so it is rebuilt from its text, which
 * reads the packet cache and is therefore usually free. Without this last
 * case, "Still stuck" on a typed problem served the demo's ladder, which is a
 * different problem's question presented as the next step on this one.
 */
async function bundleFor(
  problemId: string,
  printedText: string | undefined,
  register: (typeof REGISTERS)[number],
  parent: Awaited<ReturnType<typeof currentParent>>,
): Promise<PacketBundle> {
  if (problemId === "demo") return demoBundle(register);

  if (problemId === "typed" || !hasDatabase()) {
    if (!printedText) return demoBundle(register, copy.limits.demoBanner);
    return buildPacketFromText({
      problemId: null,
      printedText,
      childWorkText: null,
      childAnswer: null,
      register,
      language: parent.language,
      grade: parent.child?.grade ?? null,
    });
  }

  return buildPacket({
    problemId,
    register,
    language: parent.language,
    grade: parent.child?.grade ?? null,
  });
}
