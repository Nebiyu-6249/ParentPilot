import type { Metadata } from "next";

import { LogoMark } from "@/components/Logo";
import { Label, Page, Section } from "@/components/ui";
import { copy } from "@/lib/copy";
import { readSharedSession } from "@/lib/share";
import type { MoveLabelName } from "@/lib/ai/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "A shared homework session",
  // A shared link is for one teacher, not for a search index.
  robots: { index: false, follow: false },
};

const LABEL_NAMES: Partial<Record<MoveLabelName, string>> = {
  PROBING_QUESTION: "Questions that handed the thinking back",
  SPECIFIC_PRAISE: "Praise that named what was done",
  PRODUCTIVE_WAIT: "Time spent waiting",
  GIVES_ANSWER: "Answers given",
  GENERIC_PRAISE: "Praise with no content",
  CRITICISM: "Criticism",
  TAKES_OVER: "Stretches where the adult held the floor",
};

/**
 * What a teacher sees.
 *
 * No account needed, and nothing here came from a recording: every number is
 * derived from move labels and timestamps. The explainer is not decoration,
 * a teacher opens this cold with no idea what ParentPilot is.
 */
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await readSharedSession(token);

  if (result.state !== "ok") {
    return (
      <Page>
        <Section title={copy.shared.heading}>
          <p style={{ fontSize: 17 }}>
            {result.state === "expired" ? copy.shared.expired : copy.shared.unknown}
          </p>
        </Section>
      </Page>
    );
  }

  const s = result.session;
  const counts = Object.entries(s.moveCounts)
    .filter(([label, n]) => n > 0 && label in LABEL_NAMES)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Page>
      <header style={{ paddingBottom: 18 }}>
        <div style={{ marginBottom: 16 }}>
          <LogoMark size={34} />
        </div>
        <h1 style={{ fontSize: "var(--type-h1)" }}>{copy.shared.heading}</h1>
        <p style={{ marginTop: 12, fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)" }}>
          {new Date(s.startedAt).toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" · "}
          {s.minutes} minutes
          {s.grade !== null ? ` · ${s.grade === 0 ? "Kindergarten" : `Grade ${s.grade}`}` : ""}
        </p>
        <p
          style={{
            marginTop: 18,
            paddingLeft: 14,
            borderLeft: "2px solid var(--annotation)",
            fontSize: 16,
          }}
        >
          {copy.shared.explainer}
        </p>
      </header>

      <Section title={copy.shared.problemsHeading}>
        {s.problems.length === 0 ? (
          <p style={{ color: "var(--text-on-sheet-muted)" }}>Nothing was recorded for this session.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {s.problems.map((problem, index) => (
              <li
                key={`${problem.printedText}-${index}`}
                style={{ padding: "16px 0", borderBottom: "1px solid var(--rule-on-sheet)" }}
              >
                <p style={{ fontSize: 18 }}>{problem.printedText}</p>

                {problem.childWorkText && (
                  <pre
                    style={{
                      margin: "8px 0 0",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--type-small)",
                      whiteSpace: "pre-wrap",
                      color: "var(--text-on-sheet-muted)",
                      borderLeft: "1px solid var(--rule-on-sheet)",
                      paddingLeft: 12,
                    }}
                  >
                    {problem.childWorkText}
                  </pre>
                )}

                {problem.misconceptionName && (
                  <p style={{ marginTop: 10, fontSize: 16 }}>
                    <span style={{ color: "var(--annotation)" }}>{copy.shared.errorHeading}: </span>
                    {problem.misconceptionName}
                  </p>
                )}

                {problem.standardCode && (
                  <p style={{ marginTop: 8, fontSize: "var(--type-micro)", color: "var(--text-on-sheet-muted)" }}>
                    {problem.standardCode}
                    {problem.standardPlain ? ` · ${problem.standardPlain}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={copy.shared.ratioHeading}>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            color: "var(--annotation)",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {s.autonomyScore.toFixed(2)}
        </p>
        <p style={{ marginTop: 12, fontSize: 17 }}>{s.autonomyReading}</p>

        {counts.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0" }}>
            {counts.map(([label, n]) => (
              <li
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--rule-on-sheet)",
                  fontSize: 16,
                }}
              >
                <span>{LABEL_NAMES[label as MoveLabelName]}</span>
                <span style={{ color: "var(--text-on-sheet-muted)", fontVariantNumeric: "tabular-nums" }}>{n}</span>
              </li>
            ))}
          </ul>
        )}

        {s.parked && (
          <p style={{ marginTop: 16, fontSize: 16, color: "var(--alert-fg)" }}>
            This session was stopped early on purpose, rather than pushed to the end.
          </p>
        )}
      </Section>

      <div style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 20 }}>
        <Label>About these numbers</Label>
        <p style={{ marginTop: 8, fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)" }}>
          They count what kind of thing was said and when. The words themselves were never recorded,
          uploaded or stored, and no audio exists.
        </p>
      </div>
    </Page>
  );
}
