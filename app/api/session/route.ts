import { NextResponse } from "next/server";

import { prisma, hasDatabase } from "@/lib/db";
import { currentParent } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Opens a Live Mode session.
 *
 * Called when the parent actually starts listening, not when the page loads.
 * Creating it on render meant a parent who opened /live, thought better of it
 * and went back left an empty session behind, and a refresh left two.
 */
export async function POST(): Promise<Response> {
  const parent = await currentParent();
  if (!hasDatabase() || !parent.child) return NextResponse.json({ sessionId: null });

  try {
    const session = await prisma.session.create({
      data: { childId: parent.child.id, mode: "LIVE" },
    });
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("[api/session] create failed", error);
    return NextResponse.json({ sessionId: null });
  }
}
