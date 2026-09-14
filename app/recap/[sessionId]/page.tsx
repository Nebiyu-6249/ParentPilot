import type { Metadata } from "next";
import Link from "next/link";

import { buttonStyle, Label, Page, Section } from "@/components/ui";
import { autonomyReading, autonomyScore, countMoves, DIRECTIVE, SUPPORTIVE } from "@/lib/autonomy";
import { copy } from "@/lib/copy";
import { prisma, hasDatabase } from "@/lib/db";
import type { MoveLabelName } from "@/lib/ai/schemas";

export const metadata: Metadata = { title: "Session recap" };

/** Parent-facing names for the move labels. Never clinical, never a grade. */
const LABEL_NAMES: Record<MoveLabelName, string> = {
  PROBING_QUESTION: "Questions that handed the thinking back",
  SPECIFIC_PRAISE: "Praise that named what they did",
  PRODUCTIVE_WAIT: "Time spent waiting",
  GIVES_ANSWER: "Answers given",
  GENERIC_PRAISE: "Praise with no content",
  CRITICISM: "Criticism",
  TAKES_OVER: "Stretches where you held the floor",
  ANXIETY_STATEMENT: "Things said about your own math",
  ESCALATION: "Moments it got heated",
  NEUTRAL: "Everything else",
};

export default async function RecapPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  const session =
    hasDatabase() && sessionId !== "none"
      ? await prisma.session
          .findUnique({ where: { id: sessionId }, include: { moves: true } })
          .catch(() => null)
      : null;

  const labels = (session?.moves ?? []).map((m) => m.label as MoveLabelName);
  const counts = countMoves(labels);
  const score = session?.autonomyScore ?? autonomyScore(counts);
  const shown = [...SUPPORTIVE, ...DIRECTIVE, "ANXIETY_STATEMENT" as const, "ESCALATION" as const]
    .map((label) => ({ label, count: counts[label] ?? 0 }))
    .filter((row) => row.count > 0);

  return (
    <Page>
      <header style={{ padding: "44px 0 24px" }}>
        <h1 style={{ fontSize: "clamp(1.8rem, 6vw, 2.4rem)" }}>{copy.recap.heading}</h1>
      </header>

      <Section title={copy.recap.ratioLabel} note={copy.recap.ratioHelp}>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 56,
            color: "var(--emerald)",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {score.toFixed(2)}
        </p>
        <p style={{ marginTop: 14, fontSize: 17 }}>{autonomyReading(score)}</p>
        {session?.parked && (
          <p style={{ marginTop: 14, fontSize: 16, color: "var(--alert)" }}>
            You stopped this one early. That was the right call.
          </p>
        )}
      </Section>

      <Section title={copy.recap.movesHeading}>
        {shown.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>{copy.recap.noMoves}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {shown.map((row) => (
              <li
                key={row.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: "1px solid var(--rule)",
                  fontSize: 16,
                }}
              >
                <span>{LABEL_NAMES[row.label]}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{row.count}</span>
              </li>
            ))}
          </ul>
        )}
        <p style={{ marginTop: 20, fontSize: 14, color: "var(--muted)" }}>
          These are counts of what kind of thing was said, and when. We never recorded or kept the
          words themselves.
        </p>
      </Section>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 28 }}>
        <Label>Next</Label>
        <Link
          href="/capture"
          style={{ ...buttonStyle("primary", true), textDecoration: "none", display: "block", textAlign: "center" }}
        >
          {copy.recap.again}
        </Link>
      </div>
    </Page>
  );
}
