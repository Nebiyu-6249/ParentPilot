import type { Metadata } from "next";
import Link from "next/link";

import { buttonStyle } from "@/components/ui";
import { copy } from "@/lib/copy";

/**
 * Research.
 *
 * A credibility asset, so it is built to be checked rather than admired. Each
 * finding gets three things: the claim, what the product does because of it,
 * and the source. The middle one is the part that matters. A page that lists
 * citations without saying which line of the product each one caused is a page
 * borrowing authority, and a reader who notices that trusts the rest less.
 *
 * It ends by saying what none of it proves. That section is not modesty: a
 * page of findings with no limits stated reads as marketing, and the one thing
 * this product cannot afford is to be read as a company making claims about
 * children's learning that it has not measured.
 */

export const metadata: Metadata = {
  title: copy.research.title,
  description: copy.research.description,
  openGraph: {
    title: `${copy.research.title}, ${copy.brand.name}`,
    description: copy.research.description,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `${copy.research.title}, ${copy.brand.name}`,
    description: copy.research.description,
  },
};

interface Finding {
  claim: string;
  why: string;
  source: string;
}

function FindingList({ findings }: { findings: readonly Finding[] }) {
  return (
    <ol className="pp-findings">
      {findings.map((finding) => (
        <li key={finding.source} className="pp-finding">
          <p className="pp-finding-claim">{finding.claim}</p>
          <p className="pp-finding-why">{finding.why}</p>
          <p className="pp-finding-source">{finding.source}</p>
        </li>
      ))}
    </ol>
  );
}

export default function ResearchPage() {
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
          <h1 className="pp-display" style={{ color: "var(--text-on-frame)", maxWidth: "16ch" }}>
            {copy.research.heading}
          </h1>
          <p
            style={{
              marginTop: 20,
              maxWidth: "56ch",
              fontSize: "var(--type-body)",
              color: "var(--text-on-frame-muted)",
            }}
          >
            {copy.research.intro}
          </p>
        </div>
      </section>

      <div className="pp-desk">
        <div className="pp-sheet-page">
          {/* The whole argument, before any of the evidence. A reader who
              stops after one paragraph should still have it. */}
          <section style={{ paddingBottom: 32 }}>
            <h2 style={{ fontSize: "var(--type-h3)", color: "var(--text-on-sheet-muted)", fontWeight: 500 }}>
              {copy.research.thesisHeading}
            </h2>
            <p className="pp-pull">{copy.research.thesis}</p>
          </section>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.research.findingsHeading}</h2>
            <FindingList findings={copy.research.findings} />
          </section>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 8 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.research.aiHeading}</h2>
            <p style={{ marginTop: 10, maxWidth: "58ch", color: "var(--text-on-sheet-muted)" }}>
              {copy.research.aiIntro}
            </p>
            <FindingList findings={copy.research.ai} />
          </section>

          {/* The limits, given the same weight as the findings rather than a
              footnote. */}
          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 8 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.research.honestHeading}</h2>
            <p style={{ marginTop: 12, maxWidth: "62ch", fontSize: "var(--type-body)", lineHeight: 1.65 }}>
              {copy.research.honest}
            </p>
            <p
              style={{
                marginTop: 18,
                maxWidth: "62ch",
                fontSize: "var(--type-small)",
                color: "var(--text-on-sheet-muted)",
              }}
            >
              {copy.research.citationNote}
            </p>
          </section>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 8 }}>
            <Link href="/how-it-works" style={{ ...buttonStyle("secondary"), display: "inline-block" }}>
              {copy.howItWorks.title}
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
