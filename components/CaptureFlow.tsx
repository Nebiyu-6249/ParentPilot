"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import StatusLine from "@/components/StatusLine";
import { Banner, buttonStyle, inputStyle, Label, Page } from "@/components/ui";
import { useMessages } from "@/components/LocaleProvider";
import { LIMITS } from "@/lib/limits.client";
import type { ExtractResponse } from "@/app/api/extract/route";

type Phase = "capture" | "reading" | "review";

interface Draft {
  id: string | null;
  index: number;
  printedText: string;
  childWorkText: string;
  childAnswer: string;
  ocrConfidence: number;
  unreadableNote: string | null;
}

/**
 * Capture, then transcription review, then the packet.
 *
 * The review step is not optional and is not a confirmation dialog. Every
 * downstream step, standard matching, misconception detection, arithmetic
 * verification and the packet itself, inherits this text, so a misread digit
 * here becomes a confidently wrong packet later. One tap to fix it, before
 * anything is generated.
 */
export default function CaptureFlow() {
  const t = useMessages();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("capture");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageNote, setPageNote] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [typedWork, setTypedWork] = useState("");

  async function onFile(file: File): Promise<void> {
    setError(null);
    setNotice(null);

    if (!file.type.startsWith("image/")) return setError(t.capture.wrongType);
    if (file.size > LIMITS.maxUploadBytes) return setError(t.capture.tooLarge);

    setPhase("reading");

    const form = new FormData();
    form.append("image", file);

    try {
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const data = (await response.json()) as ExtractResponse & { error?: string };

      if (data.error) {
        setError(data.error);
        setPhase("capture");
        return;
      }

      setNotice(data.notice ?? null);
      setPageNote(data.pageNote ?? null);

      if (!data.problems.length) {
        setError(data.pageNote ?? t.errors.noProblem);
        setPhase("capture");
        return;
      }

      setDrafts(
        data.problems.map((p) => ({
          id: p.id,
          index: p.index,
          printedText: p.printedText,
          childWorkText: p.childWorkText ?? "",
          childAnswer: p.childAnswer ?? "",
          ocrConfidence: p.ocrConfidence,
          unreadableNote: p.unreadableNote ?? null,
        })),
      );
      setPhase("review");
    } catch {
      setError(t.errors.generic);
      setPhase("capture");
    }
  }

  async function useTyped(): Promise<void> {
    if (!typed.trim()) return;
    setPhase("reading");
    try {
      const response = await fetch("/api/problem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ printedText: typed.trim(), childWorkText: typedWork.trim() || null }),
      });
      const data = (await response.json()) as { problemId: string | null };
      router.push(`/problem/${data.problemId ?? "demo"}`);
    } catch {
      setError(t.errors.generic);
      setPhase("capture");
    }
  }

  async function confirmTranscription(): Promise<void> {
    const first = drafts[0];
    if (!first) return;

    await Promise.all(
      drafts
        .filter((d) => d.id)
        .map((d) =>
          fetch("/api/extract", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              problemId: d.id,
              printedText: d.printedText,
              childWorkText: d.childWorkText || null,
              childAnswer: d.childAnswer || null,
            }),
          }).catch(() => undefined),
        ),
    );

    router.push(`/problem/${first.id ?? "demo"}`);
  }

  function update(index: number, patch: Partial<Draft>): void {
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  if (phase === "reading") {
    return (
      <Page>
        <StatusLine step={t.status.reading} />
      </Page>
    );
  }

  if (phase === "review") {
    return (
      <Page>
        <header style={{ padding: "36px 0 20px" }}>
          <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{t.transcription.heading}</h1>
          <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 16 }}>{t.transcription.help}</p>
        </header>

        {notice && <Banner text={notice} />}
        {pageNote && <Banner text={pageNote} />}

        {drafts.map((draft, index) => (
          <section
            key={`${draft.index}-${draft.id ?? index}`}
            style={{ borderTop: "1px solid var(--rule)", padding: "26px 0" }}
          >
            {draft.ocrConfidence < 0.7 && (
              <Banner
                tone="alert"
                text={draft.unreadableNote ?? t.transcription.lowConfidence}
              />
            )}

            <div style={{ marginBottom: 18 }}>
              <Label>{t.transcription.printedLabel}</Label>
              <input
                value={draft.printedText}
                onChange={(e) => update(index, { printedText: e.target.value })}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <Label>{t.transcription.workLabel}</Label>
              <textarea
                value={draft.childWorkText}
                onChange={(e) => update(index, { childWorkText: e.target.value })}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div>
              <Label>{t.transcription.answerLabel}</Label>
              <input
                value={draft.childAnswer}
                onChange={(e) => update(index, { childAnswer: e.target.value })}
                style={inputStyle}
              />
            </div>
          </section>
        ))}

        <div
          style={{
            position: "sticky",
            bottom: 0,
            background: "var(--paper)",
            borderTop: "1px solid var(--rule)",
            padding: "14px 0 20px",
            marginTop: 30,
          }}
        >
          <button type="button" onClick={confirmTranscription} style={buttonStyle("primary", true)}>
            {t.transcription.save}
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <header style={{ padding: "36px 0 20px" }}>
        <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{t.capture.heading}</h1>
        <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 16 }}>{t.capture.help}</p>
      </header>

      {error && <Banner tone="alert" text={error} />}
      {notice && <Banner text={notice} />}

      <section style={{ borderTop: "1px solid var(--rule)", padding: "28px 0" }}>
        <Label>{t.capture.photoLabel}</Label>
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
          {t.capture.submitPhoto}
        </button>
        <p style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}>{t.capture.sizeLimit}</p>
      </section>

      <section style={{ borderTop: "1px solid var(--rule)", padding: "28px 0" }}>
        <Label>{t.capture.textLabel}</Label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t.capture.textPlaceholder}
          style={{ ...inputStyle, marginBottom: 16 }}
        />
        <Label>{t.capture.childWorkLabel}</Label>
        <textarea
          value={typedWork}
          onChange={(e) => setTypedWork(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
        />
        <button
          type="button"
          onClick={useTyped}
          disabled={!typed.trim()}
          style={buttonStyle("secondary", true)}
        >
          {t.capture.submitText}
        </button>
      </section>
    </Page>
  );
}
