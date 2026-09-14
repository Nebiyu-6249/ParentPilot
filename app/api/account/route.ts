import { NextResponse } from "next/server";

import { prisma, hasDatabase } from "@/lib/db";
import { clearSession, currentParent } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Export everything we hold about this parent.
 *
 * Deliberately a full dump rather than a summary: if a parent asks what we
 * have, the honest answer is the rows themselves. Note what is absent from
 * the export, because it is absent from the database: no photos, no audio,
 * no transcripts.
 */
export async function GET(): Promise<Response> {
  const profile = await currentParent();
  if (!hasDatabase() || profile.id === "anonymous") {
    return NextResponse.json({ parent: null, note: "Nothing is stored for this browser." });
  }

  try {
    const parent = await prisma.parent.findUnique({
      where: { id: profile.id },
      include: {
        children: {
          include: {
            assignments: { include: { problems: { include: { packets: true } } } },
            sessions: { include: { moves: true, cards: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        note: "This is everything. There are no worksheet images and no Live Mode transcripts, because neither is ever stored.",
        parent,
      },
      {
        headers: {
          "content-disposition": `attachment; filename="parentpilot-export.json"`,
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/account] export failed", error);
    return NextResponse.json({ error: "export failed" }, { status: 500 });
  }
}

/**
 * Delete everything.
 *
 * Cascades are declared on the schema relations, so deleting the Parent row
 * removes children, assignments, problems, packets, sessions, moves and
 * cards with it. The session cookie is cleared in the same request so the
 * browser is not left pointing at an id that no longer exists.
 */
export async function DELETE(): Promise<Response> {
  const profile = await currentParent();

  if (hasDatabase() && profile.id !== "anonymous") {
    try {
      await prisma.parent.delete({ where: { id: profile.id } });
    } catch (error) {
      console.error("[api/account] delete failed", error);
      return NextResponse.json({ error: "delete failed" }, { status: 500 });
    }
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
