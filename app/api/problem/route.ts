import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma, hasDatabase } from "@/lib/db";
import { ensureParent } from "@/lib/session";

export const runtime = "nodejs";

const bodySchema = z.object({
  printedText: z.string().min(1).max(600),
  childWorkText: z.string().max(2000).nullable().optional(),
  childAnswer: z.string().max(200).nullable().optional(),
});

/**
 * Creates a problem from typed text, for the parent who would rather type
 * than photograph. Same downstream pipeline, no vision call.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const parent = await ensureParent();
  if (!hasDatabase() || !parent.child) {
    // Without a child profile there is nowhere to hang an assignment, so the
    // demo fixture stands in rather than an error page.
    return NextResponse.json({ problemId: null });
  }

  try {
    const assignment = await prisma.assignment.create({
      data: {
        childId: parent.child.id,
        source: "TEXT",
        pageUrls: [],
        problems: {
          create: [
            {
              index: 0,
              printedText: parsed.data.printedText,
              childWorkText: parsed.data.childWorkText ?? null,
              childAnswer: parsed.data.childAnswer ?? null,
              ocrConfidence: 1,
            },
          ],
        },
      },
      include: { problems: true },
    });

    return NextResponse.json({ problemId: assignment.problems[0]?.id ?? null });
  } catch (error) {
    console.error("[api/problem] failed", error);
    return NextResponse.json({ problemId: null });
  }
}
