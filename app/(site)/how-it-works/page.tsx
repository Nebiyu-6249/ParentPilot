import type { Metadata } from "next";
import Link from "next/link";

import { buttonStyle } from "@/components/ui";
import { copy } from "@/lib/copy";

/**
 * How it works.
 *
 * Five steps down a single numbered column, not five cards in a grid. The
 * order is the argument: each step only makes sense because of the one above
 * it, and a grid says the opposite by letting the eye start anywhere.
 *
 * Every step carries a second, quieter line. That is where the thing a
 * sceptical parent actually wants lives: what happens to the photograph, what
 * the badge means, what the product does when it does not know.
 */

export const metadata: Metadata = {
  title: copy.howItWorks.title,
  description: copy.howItWorks.description,
  openGraph: {
    title: `${copy.howItWorks.title}, ${copy.brand.name}`,
    description: copy.howItWorks.description,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `${copy.howItWorks.title}, ${copy.brand.name}`,
    description: copy.howItWorks.description,
  },
};

export default function HowItWorksPage() {
  return (
    <main>
      <section
        style={{
          background: "var(--surface-frame)",
          color: "var(--text-on-frame)",
          borderBottom: "1px solid var(--rule-on-frame)",
        }}
      >
        <div className="pp-article-head" style={{ paddingBlock: "clamp(40px, 6vw, 76px)" }}>
          <h1 className="pp-display" style={{ color: "var(--text-on-frame)", maxWidth: "15ch" }}>
            {copy.howItWorks.heading}
          </h1>
          <p
            style={{
              marginTop: 20,
              maxWidth: "52ch",
              fontSize: "var(--type-body)",
              color: "var(--text-on-frame-muted)",
            }}
          >
            {copy.howItWorks.intro}
          </p>
        </div>
      </section>

      <div className="pp-desk">
        <div className="pp-sheet-page">
          <ol className="pp-steps">
            {copy.howItWorks.steps.map((step) => (
              <li key={step.n} className="pp-step">
                <span className="pp-step-n" aria-hidden="true">
                  {step.n}
                </span>
                <div>
                  <h2 className="pp-step-title">{step.title}</h2>
                  <p className="pp-step-body">{step.body}</p>
                  <p className="pp-step-note">{step.note}</p>
                </div>
              </li>
            ))}
          </ol>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 8 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.howItWorks.notHeading}</h2>
            <ul className="pp-plain-list">
              {copy.howItWorks.not.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 32 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.howItWorks.ctaHeading}</h2>
            <p style={{ marginTop: 10, maxWidth: "50ch", color: "var(--text-on-sheet-muted)" }}>
              {copy.howItWorks.ctaBody}
            </p>
            <Link href="/app" style={{ ...buttonStyle("primary"), marginTop: 20, display: "inline-block" }}>
              {copy.howItWorks.cta}
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
