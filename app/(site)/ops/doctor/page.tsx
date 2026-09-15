import type { Metadata } from "next";
import Link from "next/link";

import OpsGate from "@/components/OpsGate";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { Page, Section } from "@/components/ui";
import { runDoctor, type CheckState, type DoctorEmail } from "@/lib/doctor";
import { isOperator, opsConfigured } from "@/lib/ops";

export const metadata: Metadata = { title: "Doctor" };
export const dynamic = "force-dynamic";

const STATE_COLOUR: Record<CheckState, string> = {
  ok: "var(--annotation)",
  warn: "var(--text-on-sheet-muted)",
  fail: "var(--alert-fg)",
};

export default async function DoctorPage() {
  if (!opsConfigured()) {
    return (
      <Page>
        <Section title="Doctor">
          <p style={{ fontSize: 17 }}>
            OPS_PASSWORD is not set in this environment, so this page is closed. Set it and redeploy.
          </p>
        </Section>
      </Page>
    );
  }

  if (!(await isOperator())) return <OpsGate />;

  const report = await runDoctor();
  const failing = report.checks.filter((c) => c.state === "fail").length;

  return (
    <Page>
      <header style={{ padding: "40px 0 8px" }}>
        <h1 style={{ fontSize: "var(--type-h1)" }}>Doctor</h1>
        <p style={{ marginTop: 10, color: "var(--text-on-sheet-muted)", fontSize: "var(--type-small)" }}>
          {failing === 0
            ? "Every check passed. This deployment is live, not degraded."
            : `${failing} of ${report.checks.length} checks failing.`}
        </p>
      </header>

      {report.headline && (
        <p
          role="alert"
          style={{
            margin: "20px 0 0",
            border: `2px solid var(--alert-fg)`,
            color: "var(--alert-fg)",
            padding: "16px 18px",
            fontSize: 17,
            maxWidth: "none",
          }}
        >
          {report.headline}
        </p>
      )}

      <Section title="Checks">
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {report.checks.map((check) => (
            <li
              key={check.name}
              style={{
                display: "grid",
                gridTemplateColumns: "20px minmax(0, 1fr)",
                gap: 12,
                alignItems: "start",
                padding: "14px 0",
                borderBottom: "1px solid var(--rule-on-sheet)",
              }}
            >
              <span style={{ color: STATE_COLOUR[check.state], marginTop: 2 }}>
                {check.state === "ok" ? <CheckIcon size={18} /> : <AlertIcon size={18} />}
              </span>
              <span>
                <span style={{ display: "block", fontWeight: 500 }}>{check.name}</span>
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--type-small)",
                    color: check.state === "fail" ? "var(--alert-fg)" : "var(--text-on-sheet-muted)",
                    wordBreak: "break-word",
                  }}
                >
                  {check.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Its own section rather than one more row in the list above. The
          failure this was built for was a 403 from Resend that the product
          discarded, so every part of the picture is named separately: what is
          configured, what it is configured as, and what actually came back. */}
      <Section title="Email delivery">
        <dl style={{ margin: 0 }}>
          {emailFacts(report.email).map((fact) => (
            <div
              key={fact.label}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: 2,
                padding: "12px 0",
                borderBottom: "1px solid var(--rule-on-sheet)",
              }}
            >
              <dt style={{ fontSize: "var(--type-micro)", color: "var(--text-on-sheet-muted)" }}>
                {fact.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: "var(--type-small)",
                  color: fact.alarming ? "var(--alert-fg)" : "var(--text-on-sheet)",
                  wordBreak: "break-word",
                }}
              >
                {fact.when && (
                  <span
                    style={{
                      display: "block",
                      fontSize: "var(--type-micro)",
                      color: "var(--text-on-sheet-muted)",
                    }}
                  >
                    {fact.when}
                  </span>
                )}
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Last 10 failures">
        {report.failures.length === 0 ? (
          <p style={{ color: "var(--text-on-sheet-muted)" }}>No failures recorded.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {report.failures.map((failure, index) => (
              <li
                key={`${failure.at}-${index}`}
                style={{ padding: "12px 0", borderBottom: "1px solid var(--rule-on-sheet)" }}
              >
                <p style={{ fontSize: "var(--type-micro)", color: "var(--text-on-sheet-muted)" }}>
                  {failure.at} · {failure.scope}
                </p>
                <p style={{ fontSize: "var(--type-small)", wordBreak: "break-word" }}>{failure.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 24 }}>
        <Link href="/ops" style={{ fontSize: "var(--type-small)" }}>
          Back to operations
        </Link>
      </div>
    </Page>
  );
}

/**
 * The four facts about email delivery, flattened for rendering.
 *
 * The key itself is never one of them. Its length and last four characters
 * are enough to tell a stale key from a current one, which is the only
 * question anyone actually asks of it.
 */
interface EmailFact {
  label: string;
  value: string;
  /** Rendered as a muted line above the value, where there is a timestamp. */
  when?: string;
  alarming: boolean;
}

function emailFacts(email: DoctorEmail): EmailFact[] {
  return [
    {
      label: "Configured",
      value: email.configured
        ? "true. Both RESEND_API_KEY and RESEND_FROM are set."
        : "false. Sign-in links are written to the server log instead of sent.",
      alarming: !email.configured,
    },
    {
      label: "RESEND_FROM",
      value: email.from ?? "not set",
      alarming: email.from === null,
    },
    {
      label: "RESEND_API_KEY",
      value: email.keyTail ?? "not set",
      alarming: email.keyTail === null,
    },
    {
      label: "Most recent failed delivery",
      value: email.lastFailure ? email.lastFailure.detail : "None recorded.",
      when: email.lastFailure?.at,
      alarming: email.lastFailure !== null,
    },
  ];
}
