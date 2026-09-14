"use client";

import { useState } from "react";

import { Banner, buttonStyle, Page, Section } from "@/components/ui";
import { copy } from "@/lib/copy";

interface Failure {
  id: string;
  at: string;
  scope: string;
  message: string;
}

export default function OpsBoard({
  counts,
  spend,
  ceiling,
  embedded,
  models,
  failures,
}: {
  counts: { key: string; count: number }[];
  spend: number;
  ceiling: number;
  embedded: number;
  models: Record<string, string>;
  failures: Failure[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const pct = ceiling > 0 ? Math.min(100, Math.round((spend / ceiling) * 100)) : 0;

  async function reset(): Promise<void> {
    const response = await fetch("/api/ops", { method: "DELETE" }).catch(() => null);
    const data = response ? ((await response.json()) as { ok: boolean; cleared?: number }) : null;
    setMessage(data?.ok ? `Cleared ${data.cleared ?? 0} rows.` : "Reset failed.");
  }

  return (
    <Page>
      <header style={{ padding: "40px 0 22px" }}>
        <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{copy.ops.heading}</h1>
      </header>

      {message && <Banner text={message} />}

      <Section title={copy.ops.todayHeading}>
        <p style={{ fontSize: 17, marginBottom: 8 }}>
          Estimated spend: <strong>${spend.toFixed(4)}</strong> of ${ceiling.toFixed(2)} ({pct}%)
        </p>
        <div
          aria-hidden="true"
          style={{ height: 8, border: "1px solid var(--rule)", marginBottom: 26 }}
        >
          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "var(--alert)" : "var(--emerald)" }} />
        </div>

        <p style={{ fontSize: 16, marginBottom: 20, color: "var(--muted)" }}>
          Standards carrying an embedding: {embedded}
        </p>

        {counts.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No calls recorded today.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {counts.map((row) => (
              <li
                key={row.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--rule)",
                  fontSize: 15,
                }}
              >
                <span style={{ wordBreak: "break-all" }}>{row.key}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Model routing">
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {Object.entries(models).map(([task, model]) => (
            <li
              key={task}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 14,
                padding: "10px 0",
                borderBottom: "1px solid var(--rule)",
                fontSize: 15,
              }}
            >
              <span>{task}</span>
              <span style={{ color: "var(--muted)" }}>{model}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={copy.ops.failuresHeading}>
        {failures.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>{copy.ops.noFailures}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {failures.map((failure) => (
              <li key={failure.id} style={{ padding: "14px 0", borderBottom: "1px solid var(--rule)" }}>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  {failure.at} · {failure.scope}
                </p>
                <p style={{ fontSize: 15, wordBreak: "break-word" }}>{failure.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 26 }}>
        <button type="button" onClick={reset} style={buttonStyle("secondary", true)}>
          {copy.ops.resetDemo}
        </button>
        <p style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>
          Clears rate buckets, the spend ledger and the failure log. Does not touch any family&apos;s data.
        </p>
      </div>
    </Page>
  );
}
