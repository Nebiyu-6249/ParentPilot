import { NextResponse } from "next/server";

import { clearSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Signs out by dropping the session cookie.
 *
 * Nothing is deleted. The account and its history stay, and the next sign-in
 * link opens the same profile.
 */
export async function POST(): Promise<Response> {
  await clearSession();
  return NextResponse.json({ ok: true });
}
