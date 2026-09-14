import Link from "next/link";
import type { CSSProperties } from "react";

import HeroArtifact from "@/components/HeroArtifact";
import { CameraIcon, ChevronIcon, LockIcon, MicrophoneIcon, TypeIcon, type IconProps } from "@/components/icons";
import { copy } from "@/lib/copy";
import { demoBundle } from "@/lib/demo";

/**
 * The landing page.
 *
 * Opens with the product, not with an essay. The hero renders the real demo
 * packet from seed/demo-packet.json, so the first thing a parent sees is the
 * working thing rather than a description of it, and there is no marketing
 * copy pretending to be output.
 *
 * Everything below the hero is deliberately short: two actions, three lines,
 * one privacy sentence, one citation. The previous version asked a parent to
 * read four paragraphs before learning what this was.
 */

const STEP_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  camera: CameraIcon,
  type: TypeIcon,
  lock: LockIcon,
  microphone: MicrophoneIcon,
};

export default async function LandingPage() {
  // The hero is the product. Same fixture the "Try it" button opens, so the
  // page cannot drift out of sync with what the button actually shows.
  const demo = await demoBundle("STANDARD");
  const { problem, misconception, standard } = demo;

  const primaryCitation = copy.landing.research[0];
  const furtherReading = copy.landing.research.slice(1);

  return (
    <main>
      {/* ---- The desk ------------------------------------------------- */}
      <section
        style={{
          background: "var(--surface-frame)",
          color: "var(--text-on-frame)",
          borderBottom: "1px solid var(--rule-on-frame)",
        }}
      >
        <div className="pp-page" style={{ paddingBlock: "clamp(48px, 7vw, 92px)" }}>
          <div className="pp-hero-grid">
            <div className="pp-hero-words">
              <div className="pp-hero-headline">
              {/* One line, one weight, one colour. No eyebrow above it and no
                  single accented word inside it. */}
                <h1 className="pp-display" style={{ color: "var(--text-on-frame)", maxWidth: "17ch" }}>
                  {copy.brand.tagline}
                </h1>
              </div>

              <div className="pp-hero-actions">

                <p
                  style={{
                    marginTop: 22,
                    fontSize: 18,
                    color: "var(--text-on-frame-muted)",
                    maxWidth: "42ch",
                  }}
                >
                  Photograph the page. We read your child&apos;s working, check the arithmetic in
                  code, and hand you the questions to ask.
                </p>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
                  <Link href="/problem/demo" style={onFrameButton("solid")}>
                    {copy.landing.tryButton}
                  </Link>
                  <Link href="/setup" style={onFrameButton("outline")}>
                    {copy.landing.secondaryCta}
                  </Link>
                </div>

                <p
                  style={{
                    marginTop: 14,
                    fontSize: "var(--type-small)",
                    color: "var(--text-on-frame-muted)",
                  }}
                >
                  {copy.landing.tryNote}
                </p>
              </div>
            </div>

            <HeroArtifact
              printedText={problem.printedText}
              childWorkText={problem.childWorkText ?? ""}
              misconceptionName={misconception?.plainName ?? ""}
              repairQuestion={misconception?.repairQuestion ?? ""}
              standardCode={standard?.code ?? null}
              // The wrong denominator in "so 3/7", which is the mistake itself.
              ring={{ line: 2, index: 5 }}
            />
          </div>
        </div>
      </section>

      {/* ---- Paper. Everything below here is content. ----------------- */}
      <div
        className="pp-page"
        style={{
          background: "var(--surface-sheet)",
          color: "var(--text-on-sheet)",
          maxWidth: "none",
          paddingBlock: "clamp(40px, 5vw, 64px)",
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <section style={{ maxWidth: 760 }}>
          <h2 style={{ marginBottom: 4 }}>How it works</h2>
          <ul className="pp-steps" style={{ marginTop: 12 }}>
            {copy.landing.steps.map((step) => {
              const StepIcon = STEP_ICONS[step.icon] ?? CameraIcon;
              return (
                <li key={step.text} className="pp-step">
                  <StepIcon size={24} style={{ color: "var(--annotation)", marginTop: 2 }} />
                  <p style={{ fontSize: 17 }}>{step.text}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          style={{
            marginTop: 48,
            paddingTop: 32,
            borderTop: "1px solid var(--rule-on-sheet)",
            maxWidth: 760,
          }}
        >
          <h2 style={{ marginBottom: 12 }}>Privacy</h2>
          <p style={{ fontSize: 17 }}>{copy.landing.audioPromise}</p>
        </section>

        <section
          style={{
            marginTop: 48,
            paddingTop: 32,
            borderTop: "1px solid var(--rule-on-sheet)",
            maxWidth: 760,
          }}
        >
          <h2 style={{ marginBottom: 16 }}>{copy.landing.researchHeading}</h2>

          {primaryCitation && (
            <figure style={{ margin: 0 }}>
              <blockquote
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  borderLeft: "2px solid var(--annotation)",
                  fontSize: 18,
                }}
              >
                {primaryCitation.claim}
              </blockquote>
              <figcaption
                style={{
                  marginTop: 10,
                  paddingLeft: 20,
                  fontSize: "var(--type-small)",
                  color: "var(--text-on-sheet-muted)",
                }}
              >
                {primaryCitation.source}
              </figcaption>
            </figure>
          )}

          <details style={{ marginTop: 26 }}>
            <summary
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: "var(--type-small)",
                color: "var(--text-on-sheet-muted)",
              }}
            >
              <ChevronIcon size={16} direction="right" />
              {copy.landing.researchMoreLabel}
            </summary>

            <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0" }}>
              {furtherReading.map((item) => (
                <li
                  key={item.source}
                  style={{ padding: "16px 0", borderTop: "1px solid var(--rule-on-sheet)" }}
                >
                  <p style={{ fontSize: 16, marginBottom: 6 }}>{item.claim}</p>
                  <p style={{ fontSize: "var(--type-small)", color: "var(--text-on-sheet-muted)" }}>
                    {item.source}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <div style={{ marginTop: 52, paddingTop: 32, borderTop: "1px solid var(--rule-on-sheet)" }}>
          <Link
            href="/capture"
            style={{
              display: "inline-block",
              padding: "15px 26px",
              background: "var(--surface-frame)",
              color: "var(--text-on-frame)",
              border: "1px solid var(--surface-frame)",
              fontSize: 17,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            {copy.landing.primaryCta}
          </Link>
        </div>
        </div>
      </div>
    </main>
  );
}

/** Buttons sitting on the teal desk, not on paper. */
function onFrameButton(kind: "solid" | "outline"): CSSProperties {
  const shared: CSSProperties = {
    display: "inline-block",
    padding: "15px 24px",
    fontSize: 17,
    fontWeight: 500,
    textDecoration: "none",
    transition: "background 200ms ease-out, color 200ms ease-out",
  };

  if (kind === "solid") {
    return {
      ...shared,
      // Off-white on the desk, not emerald: emerald on teal measures 3.08,
      // which carries a mark but fails as a text colour.
      background: "var(--text-on-frame)",
      color: "var(--surface-frame)",
      border: "1px solid var(--text-on-frame)",
    };
  }

  return {
    ...shared,
    background: "transparent",
    color: "var(--text-on-frame)",
    border: "1px solid var(--border-interactive-frame)",
  };
}
