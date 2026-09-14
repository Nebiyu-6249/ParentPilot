"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonStyle, inputStyle, Label, Page } from "@/components/ui";
import { copy } from "@/lib/copy";
import type { RegisterName } from "@/lib/ai/schemas";

/**
 * Four-step calibration.
 *
 * Step 1 never asks the parent to declare their education. It shows the same
 * idea written three ways, unlabelled, and lets them pick the one they would
 * rather read. Asking directly shames exactly the people this is built for,
 * and a parent who feels judged at step one does not reach step four.
 */

const SAMPLES: { value: RegisterName; text: string }[] = [
  {
    value: "PLAIN",
    text: "When you split something into equal parts, the number on the bottom tells you how many parts the whole got cut into.",
  },
  {
    value: "STANDARD",
    text: "The denominator tells you how many equal parts make up one whole.",
  },
  {
    value: "TECHNICAL",
    text: "The denominator is the divisor of the unit interval. It sets the partition size on the number line.",
  },
];

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

const SUBJECTS = ["Fractions", "Decimals", "Place value", "Multiplication", "Division", "Ratio", "Early algebra"];

const GRADES = [
  { value: 0, label: "K" },
  ...Array.from({ length: 8 }, (_, i) => ({ value: i + 1, label: `Grade ${i + 1}` })),
];

export default function SetupFlow({
  initialRegister,
  initialLanguage,
}: {
  initialRegister: RegisterName;
  initialLanguage: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [register, setRegister] = useState<RegisterName>(initialRegister);
  const [anxietyBand, setAnxietyBand] = useState(2);
  const [firstName, setFirstName] = useState("");
  const [grade, setGrade] = useState(4);
  const [curriculum, setCurriculum] = useState("CCSS");
  const [subjects, setSubjects] = useState<string[]>(["Fractions"]);
  const [language, setLanguage] = useState(initialLanguage);
  const [saving, setSaving] = useState(false);

  async function finish(): Promise<void> {
    setSaving(true);
    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          register,
          anxietyBand,
          language,
          child: { firstName: firstName.trim() || null, grade, curriculum, subjects },
        }),
      });
    } catch {
      // Setup is a preference, not a gate. If it did not save, the defaults
      // are sane and the parent can change them in /settings later.
    }
    router.push("/capture");
  }

  return (
    <Page>
      <header style={{ padding: "36px 0 22px" }}>
        <Label>{`Step ${step} of 4`}</Label>
        <h1 style={{ fontSize: "clamp(1.7rem, 6vw, 2.2rem)" }}>{copy.setup.heading}</h1>
        <p style={{ marginTop: 12, color: "var(--muted)", fontSize: 16 }}>{copy.setup.subheading}</p>
      </header>

      {step === 1 && (
        <StepBody heading={copy.setup.step1.heading} help={copy.setup.step1.help}>
          {SAMPLES.map((sample) => (
            <button
              key={sample.value}
              type="button"
              onClick={() => setRegister(sample.value)}
              aria-pressed={register === sample.value}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "18px 20px",
                marginBottom: 12,
                fontSize: 17,
                lineHeight: 1.55,
                background: register === sample.value ? "var(--emerald)" : "transparent",
                color: register === sample.value ? "var(--paper)" : "var(--ink)",
                border: `1px solid ${register === sample.value ? "var(--emerald)" : "var(--border-interactive)"}`,
                transition: "background 200ms ease-out, color 200ms ease-out",
              }}
            >
              {sample.text}
            </button>
          ))}
        </StepBody>
      )}

      {step === 2 && (
        <StepBody heading={copy.setup.step2.heading} help={copy.setup.step2.help}>
          {copy.setup.step2.options.map((option) => (
            <button
              key={option.band}
              type="button"
              onClick={() => setAnxietyBand(option.band)}
              aria-pressed={anxietyBand === option.band}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "17px 20px",
                marginBottom: 12,
                fontSize: 17,
                background: anxietyBand === option.band ? "var(--emerald)" : "transparent",
                color: anxietyBand === option.band ? "var(--paper)" : "var(--ink)",
                border: `1px solid ${anxietyBand === option.band ? "var(--emerald)" : "var(--border-interactive)"}`,
                transition: "background 200ms ease-out, color 200ms ease-out",
              }}
            >
              {option.label}
            </button>
          ))}
        </StepBody>
      )}

      {step === 3 && (
        <StepBody heading={copy.setup.step3.heading} help={copy.setup.step3.help}>
          <div style={{ marginBottom: 22 }}>
            <Label>{copy.setup.step3.nameLabel}</Label>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              style={inputStyle}
              maxLength={40}
              autoComplete="off"
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <Label>{copy.setup.step3.gradeLabel}</Label>
            <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} style={inputStyle}>
              {GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 22 }}>
            <Label>{copy.setup.step3.curriculumLabel}</Label>
            <select value={curriculum} onChange={(e) => setCurriculum(e.target.value)} style={inputStyle}>
              <option value="CCSS">Common Core (CCSS)</option>
              <option value="TEKS">Texas (TEKS)</option>
              <option value="OTHER">Something else</option>
            </select>
          </div>

          <div>
            <Label>{copy.setup.step3.subjectsLabel}</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUBJECTS.map((subject) => {
                const on = subjects.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    onClick={() =>
                      setSubjects((current) =>
                        on ? current.filter((s) => s !== subject) : [...current, subject],
                      )
                    }
                    aria-pressed={on}
                    style={{
                      padding: "9px 14px",
                      fontSize: 15,
                      background: on ? "var(--emerald)" : "transparent",
                      color: on ? "var(--paper)" : "var(--muted)",
                      border: `1px solid ${on ? "var(--emerald)" : "var(--border-interactive)"}`,
                    }}
                  >
                    {subject}
                  </button>
                );
              })}
            </div>
          </div>
        </StepBody>
      )}

      {step === 4 && (
        <StepBody heading={copy.setup.step4.heading} help={copy.setup.step4.help}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </StepBody>
      )}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--paper)",
          borderTop: "1px solid var(--rule)",
          padding: "14px 0 20px",
          marginTop: 36,
          display: "flex",
          gap: 12,
        }}
      >
        {step > 1 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} style={buttonStyle("quiet")}>
            {copy.setup.back}
          </button>
        )}
        {step < 4 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} style={buttonStyle("primary", true)}>
            {copy.setup.next}
          </button>
        ) : (
          <button type="button" onClick={finish} disabled={saving} style={buttonStyle("primary", true)}>
            {saving ? copy.common.loading : copy.setup.finish}
          </button>
        )}
      </div>
    </Page>
  );
}

function StepBody({
  heading,
  help,
  children,
}: {
  heading: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pp-settle" style={{ borderTop: "1px solid var(--rule)", paddingTop: 30 }}>
      <h2 style={{ fontSize: "1.3rem", marginBottom: 10 }}>{heading}</h2>
      <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 26 }}>{help}</p>
      {children}
    </section>
  );
}
