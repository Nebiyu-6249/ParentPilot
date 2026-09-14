import { NextResponse } from "next/server";

import { createShareLink, revokeShareLink, SHARE_TTL_DAYS } from "@/lib/share";
import { currentParent } from "@/lib/session";

export const runtime = "nodejs";

/** Creates a share link. Only the parent who owns the session may. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parent = await currentParent();
  if (parent.id === "anonymous") return NextResponse.json({ ok: false }, { status: 401 });

  const link = await createShareLink(id, parent.id);
  if (!link) return NextResponse.json({ ok: false }, { status: 404 });

  return NextResponse.json({
    ok: true,
    token: link.token,
    expiresAt: link.expiresAt.toISOString(),
    days: SHARE_TTL_DAYS,
  });
}

/** Revokes it. The URL stops opening immediately. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parent = await currentParent();
  if (parent.id === "anonymous") return NextResponse.json({ ok: false }, { status: 401 });

  const revoked = await revokeShareLink(id, parent.id);
  return NextResponse.json({ ok: revoked }, { status: revoked ? 200 : 404 });
}
