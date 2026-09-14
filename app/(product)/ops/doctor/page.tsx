import type { Metadata } from "next";
import Link from "next/link";

import OpsGate from "@/components/OpsGate";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { Page, Section } from "@/components/ui";
import { runDoctor, type CheckState } from "@/lib/doctor";
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
