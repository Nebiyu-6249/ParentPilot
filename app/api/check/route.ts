import { NextResponse } from "next/server";

import { analyseFinishedWork, isConfigured } from "@/lib/ai/provider";
import { clientIp, consume, logFailure, validateUpload } from "@/lib/limits";
import { copy } from "@/lib/copy";
import { toDataUrl } from "@/lib/exif";
import { currentParent } from "@/lib/session";
import type { CheckResult } from "@/lib/ai/schemas";

export const maxDuration = 60;
export const runtime = "nodejs";

export interface CheckResponse extends CheckResult {
  notice: string | null;
}

/**
 * Photograph finished work, get error types back.
 *
 * This route never returns an answer. Not "the answer is 12", not "it should
 * be 12", not a corrected line of working. The response schema has nowhere to
 * put one, so even a model that volunteers an answer cannot get it onto the
 * screen. A parent who wants the answer can hold the button on the problem
 * screen, where the friction is deliberate.
 */
export async function POST(request: Request): Promise<Response> {
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

  const verdict = await consume(clientIp(request.headers), "check");
  if (!verdict.allowed || !isConfigured()) {
    const notice = !verdict.allowed
      ? verdict.reason === "spend"
        ? copy.limits.spendBanner
        : copy.limits.banner
      : copy.limits.unconfiguredBanner;
    return NextResponse.json({ findings: [], allClear: false, notice } satisfies CheckResponse);
  }

  const parent = await currentParent();
  const bytes = new Uint8Array(await upload.arrayBuffer());

  try {
    const result = await analyseFinishedWork({
      imageDataUrl: toDataUrl(bytes, upload.type),
      register: parent.register,
      language: parent.language,
      grade: parent.child?.grade ?? null,
    });
    return NextResponse.json({ ...result, notice: null } satisfies CheckResponse);
  } catch (error) {
    await logFailure("check", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      findings: [],
      allClear: false,
      notice: copy.errors.modelTimeout,
    } satisfies CheckResponse);
  }
}
