"use client";

import { useRef, useState } from "react";

import StatusLine from "@/components/StatusLine";
import { AppBanner, appButton, AppLabel, AppPage, AppSection } from "@/components/app/AppPage";
import { useMessages } from "@/components/LocaleProvider";
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
  const t = useMessages();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File): Promise<void> {
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t.capture.wrongType);
    if (file.size > LIMITS.maxUploadBytes) return setError(t.capture.tooLarge);

    setBusy(true);
    const form = new FormData();
    form.append("image", file);

    try {
      const response = await fetch("/api/check", { method: "POST", body: form });
      const data = (await response.json()) as CheckResponse & { error?: string };
      if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <AppPage title={t.check.heading}>
        <StatusLine step={t.status.reading} />
      </AppPage>
    );
  }

  return (
    <AppPage title={t.check.heading}>
      <p className="pp-appview-note" style={{ marginBottom: 20 }}>{t.check.help}</p>

      {error && <AppBanner tone="alert" text={error} />}
      {result?.notice && <AppBanner text={result.notice} />}

      {result && (
        <AppSection title={t.check.resultHeading}>
          {result.findings.length === 0 ? (
            <p style={{ fontSize: 17 }}>{t.check.clean}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {result.findings.map((finding) => (
                <li
                  key={`${finding.problemIndex}-${finding.errorType}`}
                  style={{ padding: "20px 0", borderBottom: "1px solid var(--app-line)" }}
                >
                  <AppLabel>{`Question ${finding.problemIndex + 1}`}</AppLabel>
                  <h3 style={{ marginBottom: 10 }}>{finding.plainName}</h3>
                  <p style={{ fontSize: 16, color: "var(--app-text-dim)", marginBottom: 12 }}>
                    {finding.errorType}
                  </p>
                  <AppLabel>{t.packet.misconceptionRepair}</AppLabel>
                  <p style={{ fontSize: 17 }}>{finding.repairQuestion}</p>
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: 22, fontSize: 14, color: "var(--app-text-dim)" }}>{t.check.noAnswers}</p>
        </AppSection>
      )}

      <div style={{ borderTop: "1px solid var(--app-line)", paddingTop: 26 }}>
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
        <button type="button" onClick={() => fileRef.current?.click()} style={appButton("primary", true)}>
          {t.check.submit}
        </button>
      </div>
    </AppPage>
  );
}
