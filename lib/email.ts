import { resolveAppUrl } from "@/lib/app-url";
import { copy } from "@/lib/copy";

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

/** Reports configuration state for /ops/doctor without printing the key. */
export function emailStatus(): { configured: boolean; from: string | null; keyTail: string | null } {
  const key = process.env.RESEND_API_KEY;
  return {
    configured: emailConfigured(),
    from: process.env.RESEND_FROM ?? null,
    keyTail: key ? `${key.length} characters, ending ${key.slice(-4)}` : null,
  };
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
    console.warn(`[email] sign-in link for ${email} was not delivered (${result.reason}): ${url}`);
  }

  return result;
}
