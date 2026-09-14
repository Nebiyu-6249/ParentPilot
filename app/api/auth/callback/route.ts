import { NextResponse } from "next/server";

import { consumeMagicLink } from "@/lib/auth";
import { resolveAppUrl } from "@/lib/app-url";
import { currentParentId, startSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Opens a sign-in link.
 *
 * Redirects rather than rendering, so the token never sits in a page the
 * browser might cache or the parent might share. Failures come back to /login
 * with a reason in the query string rather than a raw error.
 */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  const base = resolveAppUrl();

  if (!token) return NextResponse.redirect(`${base}/login?error=invalid`);

  // If this browser is already an anonymous parent, the account adopts it, so
  // the worksheet they did before signing up is still theirs afterwards.
  const adopt = await currentParentId();
  const result = await consumeMagicLink(token, adopt);

  if (!result.ok) {
    return NextResponse.redirect(`${base}/login?error=${result.reason}`);
  }

  await startSession(result.parentId);
  return NextResponse.redirect(`${base}/account?welcome=1`);
}
