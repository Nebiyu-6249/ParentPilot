import { resolveAppUrl } from "@/lib/app-url";
import { copy } from "@/lib/copy";
import { prisma, hasDatabase } from "@/lib/db";
import { logFailure } from "@/lib/limits";

/**
 * Outbound email, via Resend's REST API.
 *
 * No SDK: one POST with a bearer token is less to keep current than a
 * dependency, and it keeps the serverless bundle small.
 *
 * When Resend is not configured the link is written to the server log and the
 * caller is told delivery did not happen. It is never returned to the browser.
 * Rendering a sign-in link on a page anyone can load would let a visitor sign
 * in as any address they can type.
 */

export type DeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: "unconfigured" | "failed"; detail: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export interface EmailStatus {
  configured: boolean;
  /** The address Resend is asked to send as. Wrong or unverified is the usual fault. */
  from: string | null;
  /** Never the key. Enough to tell one pasted key from another. */
  keyTail: string | null;
}

/** Reports configuration state for /ops/doctor without printing the key. */
export function emailStatus(): EmailStatus {
  const key = process.env.RESEND_API_KEY;
  return {
    configured: emailConfigured(),
    from: process.env.RESEND_FROM ?? null,
    keyTail: key ? `${key.length} characters, ending ${key.slice(-4)}` : null,
  };
}

/** The scope this module writes under, shared with the reader below. */
const FAILURE_SCOPE = "email";

/**
 * Removes the API key from a string before anyone looks at it.
 *
 * Resend puts the key in a header and never echoes it, so this should never
 * fire. It exists because the alternative to a cheap guard here is a bearer
 * token rendered on an operator page the first time a provider changes its
 * error body.
 */
function redactKey(text: string): string {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.length < 8) return text;
  return text.split(key).join("[redacted]");
}

export interface EmailFailure {
  at: string;
  detail: string;
}

/**
 * The most recent delivery failure, for /ops/doctor.
 *
 * Read from the same `FailureLog` the operations board already shows rather
 * than a table of its own, so there is one place failures live and one place
 * the reset button clears.
 */
export async function lastEmailFailure(): Promise<EmailFailure | null> {
  if (!hasDatabase()) return null;
  try {
    const row = await prisma.failureLog.findFirst({
      where: { scope: FAILURE_SCOPE },
      orderBy: { at: "desc" },
    });
    return row ? { at: row.at.toISOString(), detail: row.message } : null;
  } catch {
    return null;
  }
}

async function send(to: string, subject: string, text: string, html: string): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!key || !from) {
    return {
      delivered: false,
      reason: "unconfigured",
      detail: "RESEND_API_KEY and RESEND_FROM are not both set.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, html }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { delivered: false, reason: "failed", detail: `${response.status} ${detail}`.trim() };
    }

    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Sends a sign-in link. The link itself never reaches the browser. */
export async function sendMagicLink(email: string, token: string): Promise<DeliveryResult> {
  const url = `${resolveAppUrl()}/api/auth/callback?token=${encodeURIComponent(token)}`;

  const result = await send(
    email,
    copy.login.emailSubject,
    `${copy.login.emailBody}\n\n${url}\n\n${copy.login.emailFooter}`,
    [
      `<p style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6">${copy.login.emailBody}</p>`,
      `<p style="font-family:system-ui,sans-serif;font-size:16px"><a href="${url}">${copy.login.emailLinkLabel}</a></p>`,
      `<p style="font-family:system-ui,sans-serif;font-size:14px;color:#6E665A">${copy.login.emailFooter}</p>`,
    ].join(""),
  );

  if (!result.delivered) {
    // Local development and misconfigured deployments both land here. The
    // operator can sign in from the log; nobody else can.
    //
    // `detail` is the whole point of this line. Without it every failure reads
    // as "failed" and a wrong RESEND_FROM, an unverified domain, a revoked key
    // and a network fault are indistinguishable from each other.
    const detail = redactKey(result.detail);
    console.warn(
      `[email] sign-in link for ${email} was not delivered (${result.reason}): ${detail} :: ${url}`,
    );

    // Persisted as well as logged, because the log of a serverless function is
    // gone by the time anyone thinks to look and /ops/doctor is where they look.
    // The recipient's domain goes in, the address does not: Resend refuses by
    // domain, and an operator board is the wrong place to accumulate the email
    // addresses of parents.
    //
    // The reason is not repeated here. "unconfigured" and "failed" each have a
    // detail that already says which one it is, and prefixing produced
    // "the last attempt failed: failed: 403 ..." where this is read back.
    const domain = email.split("@")[1] ?? "unknown";
    void logFailure(FAILURE_SCOPE, `${detail} (to a ${domain} address)`);
  }

  return result;
}
