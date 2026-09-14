import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma, hasDatabase } from "@/lib/db";
import { checkPassword, grantOpsSession, isOperator } from "@/lib/ops";

export const runtime = "nodejs";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  if (!checkPassword(parsed.data.password)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await grantOpsSession(parsed.data.password);
  return NextResponse.json({ ok: true });
}

/**
 * Resets demo data: today's rate buckets, the spend ledger and the failure
 * log. Deliberately does not touch parents, children or worksheets, so an
 * operator clearing a tripped limit cannot delete a family's data by accident.
 */
export async function DELETE(): Promise<Response> {
  if (!(await isOperator())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ ok: true, cleared: 0 });

  try {
    const [buckets, spend, failures] = await Promise.all([
      prisma.rateBucket.deleteMany({}),
      prisma.spendLog.deleteMany({}),
      prisma.failureLog.deleteMany({}),
    ]);
    return NextResponse.json({
      ok: true,
      cleared: buckets.count + spend.count + failures.count,
    });
  } catch (error) {
    console.error("[api/ops] reset failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
