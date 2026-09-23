import { NextResponse } from "next/server";
import { z } from "zod";

import { issueMagicLink, pruneMagicLinks } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";
import { clientIp, consume } from "@/lib/limits";
import { messages } from "@/lib/i18n";
import { currentParent } from "@/lib/session";

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
  /* A first-time address has no profile, so this is English unless the
     browser already carries a cookie from an earlier visit. Guessing a
     language from the address would be worse than being plainly English. */
  const t = messages((await currentParent()).language);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: t.login.invalid }, { status: 400 });
  }

  // Sign-in requests are metered like everything else, so an address cannot be
  // used to send someone a hundred emails.
  const verdict = await consume(clientIp(request.headers), "packet");
  if (!verdict.allowed) {
    return NextResponse.json({ ok: true, message: t.login.sent });
  }

  const email = parsed.data.email.trim().toLowerCase();
  void pruneMagicLinks();

  const issued = await issueMagicLink(email);
  if (!issued) {
    return NextResponse.json({ ok: false, message: t.login.failed }, { status: 503 });
  }

  const delivery = await sendMagicLink(email, issued.token);

  if (!delivery.delivered && delivery.reason === "unconfigured") {
    return NextResponse.json({ ok: true, message: t.login.unconfigured });
  }
  if (!delivery.delivered) {
    return NextResponse.json({ ok: false, message: t.login.failed }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: t.login.sent });
}
