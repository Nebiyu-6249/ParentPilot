"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import RegisterControl from "@/components/RegisterControl";
import { Banner, buttonStyle, inputStyle, Page, Section } from "@/components/ui";
import { copy } from "@/lib/copy";
import type { RegisterName } from "@/lib/ai/schemas";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Espanol" },
  { code: "fr", label: "Francais" },
  { code: "pt", label: "Portugues" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "so", label: "Somali" },
];

export default function SettingsScreen({
  register: initialRegister,
  language: initialLanguage,
  anxietyBand: initialBand,
  child,
}: {
  register: RegisterName;
  language: string;
  anxietyBand: number;
  child: { id: string; firstName: string | null; grade: number; curriculum: string } | null;
}) {
  const router = useRouter();
  const [register, setRegister] = useState(initialRegister);
  const [language, setLanguage] = useState(initialLanguage);
  const [anxietyBand, setAnxietyBand] = useState(initialBand);
  const [saved, setSaved] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleted, setDeleted] = useState(false);

  async function save(next: Partial<{ register: RegisterName; language: string; anxietyBand: number }>): Promise<void> {
    const body = { register, language, anxietyBand, ...next, child: child ? { ...child, subjects: [] } : null };
    if (next.register) setRegister(next.register);
    if (next.language) setLanguage(next.language);
    if (next.anxietyBand) setAnxietyBand(next.anxietyBand);

    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch {
      setSaved(false);
    }
  }

  async function deleteEverything(): Promise<void> {
    if (confirmText !== "DELETE") return;
    await fetch("/api/account", { method: "DELETE" }).catch(() => undefined);
    setDeleted(true);
    router.refresh();
  }

  if (deleted) {
    return (
      <Page>
        <Section title={copy.settings.heading}>
          <p style={{ fontSize: 17 }}>{copy.settings.deleted}</p>
        </Section>
      </Page>
    );
  }

  return (
    <Page>
      <header style={{ padding: "40px 0 22px" }}>
        <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{copy.settings.heading}</h1>
      </header>

      {saved && <Banner text="Saved." />}

      <Section title={copy.settings.registerHeading} note={copy.settings.registerHelp}>
        {/* The section heading is "How I write to you"; the control's own
            label is "How I write". One of them is enough. */}
        <RegisterControl
          value={register}
          heading={false}
          onChange={(next) => void save({ register: next })}
        />
      </Section>

      <Section title={copy.settings.languageHeading} note={copy.setup.step4.help}>
        <select
          value={language}
          onChange={(event) => void save({ language: event.target.value })}
          style={inputStyle}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </Section>

      <Section title={copy.settings.anxietyHeading} note={copy.setup.step2.help}>
        {copy.setup.step2.options.map((option) => (
          <button
            key={option.band}
            type="button"
            onClick={() => void save({ anxietyBand: option.band })}
            aria-pressed={anxietyBand === option.band}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "14px 18px",
              marginBottom: 10,
              fontSize: 16,
              background: anxietyBand === option.band ? "var(--action)" : "transparent",
              color: anxietyBand === option.band ? "var(--action-label)" : "var(--ink)",
              border: `1px solid ${anxietyBand === option.band ? "var(--action)" : "var(--border-interactive)"}`,
            }}
          >
            {option.label}
          </button>
        ))}
      </Section>

      <Section title={copy.settings.exportHeading}>
        <a
          href="/api/account"
          download="parentpilot-export.json"
          style={{ ...buttonStyle("secondary"), textDecoration: "none", display: "inline-block" }}
        >
          {copy.settings.exportButton}
        </a>

        <div style={{ marginTop: 34, borderTop: "1px solid var(--rule)", paddingTop: 26 }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>{copy.settings.deleteConfirm}</p>
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="DELETE"
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <button
            type="button"
            onClick={deleteEverything}
            disabled={confirmText !== "DELETE"}
            style={buttonStyle("alert", true)}
          >
            {copy.settings.deleteButton}
          </button>
        </div>
      </Section>
    </Page>
  );
}
