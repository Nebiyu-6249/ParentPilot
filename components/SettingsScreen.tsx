"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import RegisterControl from "@/components/RegisterControl";
import { AppBanner, appButton, appInput, AppPage, AppSection } from "@/components/app/AppPage";
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
  child: { id: string; firstName: string | null; grade: number | null; curriculum: string } | null;
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
      <AppPage title={copy.settings.heading}>
        <AppSection>
          <p style={{ fontSize: 17 }}>{copy.settings.deleted}</p>
        </AppSection>
      </AppPage>
    );
  }

  return (
    <AppPage title={copy.settings.heading}>

      {saved && <AppBanner text="Saved." />}

      <AppSection title={copy.settings.registerHeading} note={copy.settings.registerHelp}>
        <RegisterControl value={register} onChange={(next) => void save({ register: next })} surface="app" />
      </AppSection>

      <AppSection title={copy.settings.languageHeading} note={copy.setup.step4.help}>
        <select
          value={language}
          onChange={(event) => void save({ language: event.target.value })}
          style={appInput}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </AppSection>

      <AppSection title={copy.settings.anxietyHeading} note={copy.setup.step2.help}>
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
              borderRadius: "var(--r-control)",
              /* Brand emerald when chosen, not the darker ink version: this is
                 a filled control, and --accent-ink is the accent as text. The
                 idle colour used to be --ink, a paper-surface token that is
                 dark on a dark ground and vanished in dark mode. */
              background: anxietyBand === option.band ? "var(--accent-fill)" : "transparent",
              color: anxietyBand === option.band ? "#ffffff" : "var(--app-text)",
              border: `1px solid ${
                anxietyBand === option.band ? "var(--accent-fill)" : "var(--app-border-interactive)"
              }`,
            }}
          >
            {option.label}
          </button>
        ))}
      </AppSection>

      <AppSection title={copy.settings.exportHeading}>
        <a
          href="/api/account"
          download="parentpilot-export.json"
          style={{ ...appButton("secondary"), textDecoration: "none", display: "inline-block" }}
        >
          {copy.settings.exportButton}
        </a>

        <div style={{ marginTop: 34, borderTop: "1px solid var(--app-line)", paddingTop: 26 }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>{copy.settings.deleteConfirm}</p>
          <input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="DELETE"
            style={{ ...appInput, marginBottom: 14 }}
          />
          <button
            type="button"
            onClick={deleteEverything}
            disabled={confirmText !== "DELETE"}
            style={appButton("alert", true)}
          >
            {copy.settings.deleteButton}
          </button>
        </div>
      </AppSection>
    </AppPage>
  );
}
