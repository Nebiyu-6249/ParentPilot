import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma, hasDatabase } from "@/lib/db";
import { ensureParent } from "@/lib/session";
import { REGISTERS } from "@/lib/ai/schemas";

export const runtime = "nodejs";

const bodySchema = z.object({
  register: z.enum(REGISTERS),
  anxietyBand: z.number().int().min(1).max(4),
  language: z.string().min(2).max(12),
  child: z
    .object({
      firstName: z.string().max(40).nullable(),
      /* Nullable, because a parent who does not know the year group should
         not have to invent one to finish setup. Null is read downstream as
         "infer it", never as a default year. */
      grade: z.number().int().min(0).max(8).nullable().default(null),
      curriculum: z.string().max(20),
      subjects: z.array(z.string().max(40)).max(12),
    })
    .nullable()
    .optional(),
});

/**
 * Saves calibration.
 *
 * Creates a Child row, which is a profile attached to a Parent. It has no
 * email, no password and no session of its own, and nothing in the app ever
 * authenticates as one. Grade and an optional first name are the whole of it.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const parent = await ensureParent();
  if (!hasDatabase() || parent.id === "anonymous") {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const { register, anxietyBand, language, child } = parsed.data;

  try {
    await prisma.parent.update({
      where: { id: parent.id },
      data: { register, anxietyBand, language },
    });

    if (child) {
      const existing = await prisma.child.findFirst({
        where: { parentId: parent.id },
        orderBy: { id: "desc" },
      });

      if (existing) {
        await prisma.child.update({
          where: { id: existing.id },
          data: {
            firstName: child.firstName,
            grade: child.grade,
            curriculum: child.curriculum,
            subjects: child.subjects,
          },
        });
      } else {
        await prisma.child.create({
          data: {
            parentId: parent.id,
            firstName: child.firstName,
            grade: child.grade,
            curriculum: child.curriculum,
            subjects: child.subjects,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, persisted: true });
  } catch (error) {
    console.error("[api/setup] failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
