import { NextResponse } from "next/server";

import { extractWorksheet, isConfigured, ModelError } from "@/lib/ai/provider";
import { clientIp, consume, logFailure, validateUpload } from "@/lib/limits";
import { copy } from "@/lib/copy";
import { prisma, hasDatabase } from "@/lib/db";
import { toDataUrl } from "@/lib/exif";
import { ensureParent } from "@/lib/session";
import type { Extraction } from "@/lib/ai/schemas";

export const maxDuration = 60;
export const runtime = "nodejs";

export interface ExtractResponse {
  assignmentId: string | null;
  problems: (Extraction["problems"][number] & { id: string | null })[];
  pageNote: string | null;
  notice: string | null;
}

/**
 * Photo to transcription.
 *
 * Deliberately stops at the transcription. The parent sees what we read and
 * corrects it before a single word of the packet is written, because every
 * downstream step inherits this text and a misread digit poisons all of it.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const file = form.get("image");
  const upload = file instanceof File ? file : null;

  const check = validateUpload(upload);
  if (!check.ok || !upload) {
    const message =
      check.ok || check.reason === "missing"
        ? copy.errors.noProblem
        : check.reason === "size"
          ? copy.capture.tooLarge
          : copy.capture.wrongType;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const verdict = await consume(clientIp(request.headers), "extract");
  if (!verdict.allowed) {
    const notice = verdict.reason === "spend" ? copy.limits.spendBanner : copy.limits.banner;
    return NextResponse.json({ assignmentId: null, problems: [], pageNote: null, notice } satisfies ExtractResponse);
  }

  if (!isConfigured()) {
    return NextResponse.json({
      assignmentId: null,
      problems: [],
      pageNote: null,
      notice: copy.limits.unconfiguredBanner,
    } satisfies ExtractResponse);
  }

  const parent = await ensureParent();

  // Metadata is stripped here, before the bytes leave this process. A phone
  // photo of a worksheet otherwise carries GPS coordinates to the model.
  const bytes = new Uint8Array(await upload.arrayBuffer());
  const dataUrl = toDataUrl(bytes, upload.type);

  let extraction: Extraction;
  try {
    extraction = await extractWorksheet({
      imageDataUrl: dataUrl,
      register: parent.register,
      language: parent.language,
      grade: parent.child?.grade ?? 4,
    });
  } catch (error) {
    const kind = error instanceof ModelError ? error.kind : "upstream";
    await logFailure("extract", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      assignmentId: null,
      problems: [],
      pageNote: null,
      notice: kind === "malformed" ? copy.errors.malformed : copy.errors.modelTimeout,
    } satisfies ExtractResponse);
  }

  if (!hasDatabase() || !parent.child) {
    return NextResponse.json({
      assignmentId: null,
      problems: extraction.problems.map((p) => ({ ...p, id: null })),
      pageNote: extraction.pageNote,
      notice: parent.child ? null : "Finish setup to save this worksheet. You can still read the packet now.",
    } satisfies ExtractResponse);
  }

  const assignment = await prisma.assignment.create({
    data: {
      childId: parent.child.id,
      source: "PHOTO",
      // The photo itself is not stored. Only what was read off it.
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

  return NextResponse.json({
    assignmentId: assignment.id,
    problems: extraction.problems.map((p) => ({
      ...p,
      id: assignment.problems.find((row) => row.index === p.index)?.id ?? null,
    })),
    pageNote: extraction.pageNote,
    notice: null,
  } satisfies ExtractResponse);
}

/** Corrections from the transcription review screen. */
export async function PATCH(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { problemId?: string; printedText?: string; childWorkText?: string | null; childAnswer?: string | null }
    | null;

  if (!body?.problemId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ ok: true });

  try {
    await prisma.problem.update({
      where: { id: body.problemId },
      data: {
        ...(body.printedText ? { printedText: body.printedText } : {}),
        childWorkText: body.childWorkText ?? null,
        childAnswer: body.childAnswer ?? null,
        // A parent-corrected transcription is authoritative, so any earlier
        // automated reading of it is cleared and recomputed.
        ocrConfidence: 1,
        misconceptionId: null,
        standardCode: null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logFailure("extract-patch", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: copy.errors.generic }, { status: 500 });
  }
}
