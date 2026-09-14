"use client";

import { useRef, useState } from "react";

import StatusLine from "@/components/StatusLine";
import { Banner, buttonStyle, Label, Page, Section } from "@/components/ui";
import { copy } from "@/lib/copy";
import { LIMITS } from "@/lib/limits.client";
import type { CheckResponse } from "@/app/api/check/route";

/**
 * Photograph finished work, get error types back.
 *
 * There is no code path on this screen that can display an answer, because
 * the response it renders has no field for one. A parent who wants the answer
 * goes to the problem screen and holds the button.
 */
export default function CheckFlow() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File): Promise<void> {
    setError(null);
    if (!file.type.startsWith("image/")) return setError(copy.capture.wrongType);
    if (file.size > LIMITS.maxUploadBytes) return setError(copy.capture.tooLarge);

    setBusy(true);
    const form = new FormData();
    form.append("image", file);

    try {
      const response = await fetch("/api/check", { method: "POST", body: form });
      const data = (await response.json()) as CheckResponse & { error?: string };
      if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError(copy.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Page>
        <StatusLine step={copy.status.reading} />
      </Page>
    );
  }

  return (
    <Page>
      <header style={{ padding: "36px 0 20px" }}>
        <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{copy.check.heading}</h1>
        <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 16 }}>{copy.check.help}</p>
      </header>

      {error && <Banner tone="alert" text={error} />}
      {result?.notice && <Banner text={result.notice} />}

      {result && (
        <Section title={copy.check.resultHeading}>
          {result.findings.length === 0 ? (
            <p style={{ fontSize: 17 }}>{copy.check.clean}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {result.findings.map((finding) => (
                <li
                  key={`${finding.problemIndex}-${finding.errorType}`}
                  style={{ padding: "20px 0", borderBottom: "1px solid var(--rule)" }}
                >
                  <Label>{`Question ${finding.problemIndex + 1}`}</Label>
                  <h3 style={{ marginBottom: 10 }}>{finding.plainName}</h3>
                  <p style={{ fontSize: 16, color: "var(--muted)", marginBottom: 12 }}>
                    {finding.errorType}
                  </p>
                  <Label>{copy.packet.misconceptionRepair}</Label>
                  <p style={{ fontSize: 17 }}>{finding.repairQuestion}</p>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: 22, fontSize: 14, color: "var(--muted)" }}>{copy.check.noAnswers}</p>
        </Section>
      )}

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 26 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
          style={{ display: "none" }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} style={buttonStyle("primary", true)}>
          {copy.check.submit}
        </button>
      </div>
    </Page>
  );
}
