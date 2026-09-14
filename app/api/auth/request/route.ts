import { NextResponse } from "next/server";
import { z } from "zod";

import { issueMagicLink, pruneMagicLinks } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";
import { clientIp, consume } from "@/lib/limits";
import { copy } from "@/lib/copy";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().email().max(200) });

/**
 * Asks for a sign-in link.
 *
 * Always answers the same way whether or not the address is known, so this
 * endpoint cannot be used to find out who has an account. The only case that
 * reports differently is the deployment being unable to send at all, which is
 * an operator problem rather than information about a person.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: copy.login.invalid }, { status: 400 });
  }

  // Sign-in requests are metered like everything else, so an address cannot be
  // used to send someone a hundred emails.
  const verdict = await consume(clientIp(request.headers), "packet");
  if (!verdict.allowed) {
    return NextResponse.json({ ok: true, message: copy.login.sent });
  }

  const email = parsed.data.email.trim().toLowerCase();
  void pruneMagicLinks();

  const issued = await issueMagicLink(email);
  if (!issued) {
    return NextResponse.json({ ok: false, message: copy.login.failed }, { status: 503 });
  }

  const delivery = await sendMagicLink(email, issued.token);

  if (!delivery.delivered && delivery.reason === "unconfigured") {
    return NextResponse.json({ ok: true, message: copy.login.unconfigured });
  }
  if (!delivery.delivered) {
    return NextResponse.json({ ok: false, message: copy.login.failed }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: copy.login.sent });
}
