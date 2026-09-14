import type { Metadata } from "next";

import Handwriting from "@/components/Handwriting";
import { SiteAction, SiteBody, SiteHero, SiteSection } from "@/components/site/SitePage";
import { copy } from "@/lib/copy";
import { demoBundle } from "@/lib/demo";

export const metadata: Metadata = { title: "How it works" };

/**
 * What actually happens to the photograph.
 *
 * Built from the real fixture rather than from a description of it: the problem text, the
 * child's working, the standard, the misconception and the first rung all come
 * from seed/demo-packet.json, which is the same data the product serves. A
 * page that illustrated this with invented output would be describing a
 * different product from the one behind the button.
 *
 * Numbered because this genuinely is a sequence. Each number is also a real
 * status line the server emits during generation, so the stages here are the
 * stages a parent watches go past, not a marketing decomposition.
 */
export default async function HowItWorksPage() {
  const demo = await demoBundle("STANDARD");
  const { problem, standard, misconception, packet } = demo;
  const firstRung = packet.hintLadder[0] ?? "";

  return (
    <main>
      <SiteHero
        title={copy.howItWorks.heading}
        standfirst={copy.howItWorks.standfirst}
        aside={
          <figure
            style={{
              margin: 0,
              background: "var(--surface-sheet)",
              color: "var(--text-on-sheet)",
              border: "1px solid var(--rule-on-sheet)",
              padding: "26px 24px",
            }}
          >
            <p style={{ fontSize: 22, marginBottom: 14 }}>{problem.printedText}</p>
            <Handwriting text={problem.childWorkText ?? ""} className="pp-handwriting" />
            <figcaption
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid var(--rule-on-sheet)",
                fontSize: "var(--type-small)",
                color: "var(--text-on-sheet-muted)",
              }}
            >
              {copy.howItWorks.artifactCaption}
            </figcaption>
          </figure>
        }
      />

      <SiteBody>
        <SiteSection measure="wide" first>
          <ol className="pp-stages">
            {copy.howItWorks.stages.map((stage, index) => (
              <li key={stage.title} className="pp-stage">
                <span className="pp-stage-mark" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h2 className="pp-stage-title">{stage.title}</h2>
                  <p className="pp-stage-body">{stage.body}</p>

                  {/* The artifact that stage produces, from the fixture. */}
                  <p className="pp-stage-artifact">
                    {stage.shows === "read" && (problem.childWorkText ?? "").replace(/\n/g, "  ")}
                    {stage.shows === "checked" && copy.howItWorks.checkedLine}
                    {stage.shows === "standard" && `${standard?.code ?? ""}  ${standard?.plainLanguage ?? ""}`}
                    {stage.shows === "misconception" && (misconception?.plainName ?? "")}
                    {stage.shows === "ask" && firstRung}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </SiteSection>

        <SiteSection title={copy.howItWorks.notHeading}>
          <ul className="pp-plain-list">
            {copy.howItWorks.notList.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </SiteSection>

        <SiteSection title={copy.howItWorks.failHeading}>
          <p style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 14 }}>{copy.howItWorks.failBody}</p>
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>{copy.howItWorks.failBodyTwo}</p>
        </SiteSection>

        <div style={{ marginTop: 52, paddingTop: 32, borderTop: "1px solid var(--rule-on-sheet)" }}>
          <SiteAction href="/app">{copy.landing.primaryCta}</SiteAction>
        </div>
      </SiteBody>
    </main>
  );
}
