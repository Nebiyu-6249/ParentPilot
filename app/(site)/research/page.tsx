import type { Metadata } from "next";

import { SiteAction, SiteBody, SiteHero, SiteSection } from "@/components/site/SitePage";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: "Research" };

/**
 * The research page, which opens by admitting it has none of its own.
 *
 * The usual shape here is three large numbers and a citation underneath,
 * which invites a reader to take findings about parents in general as results
 * about this product. The admission goes first instead, and each finding is
 * given a third column saying what it changed in the build. That column is
 * the only part of this page that is about ParentPilot, and keeping it
 * visibly separate from the findings is the point of the layout.
 *
 * No effect sizes are quoted. The findings are described qualitatively and
 * the papers are named, so a reader who wants the numbers goes to the source
 * rather than to a figure we drew.
 */
export default function ResearchPage() {
  return (
    <main>
      <SiteHero title={copy.research.heading} standfirst={copy.research.standfirst} />

      <SiteBody>
        <SiteSection title={copy.research.admissionHeading} first>
          <p style={{ fontSize: 18, lineHeight: 1.6 }}>{copy.research.admission}</p>
        </SiteSection>

        <SiteSection title={copy.research.tableHeading} measure="wide">
          <ol className="pp-findings">
            {copy.research.entries.map((entry) => (
              <li key={entry.source} className="pp-finding">
                <div className="pp-finding-claim">
                  <p style={{ fontSize: 18, lineHeight: 1.5 }}>{entry.finding}</p>
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: "var(--type-small)",
                      color: "var(--text-on-sheet-muted)",
                    }}
                  >
                    {entry.source}
                  </p>
                </div>

                {/* The only column about this product, kept visibly apart from
                    the finding so the two are not read as one claim. */}
                <div className="pp-finding-consequence">
                  <p style={{ fontSize: 13, color: "var(--annotation)", marginBottom: 8 }}>
                    {copy.research.columnConsequence}
                  </p>
                  <p style={{ fontSize: 16, lineHeight: 1.6 }}>{entry.consequence}</p>
                </div>
              </li>
            ))}
          </ol>
        </SiteSection>

        <SiteSection title={copy.research.corpusHeading}>
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>{copy.research.corpusBody}</p>
        </SiteSection>

        <SiteSection title={copy.research.limitsHeading}>
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>{copy.research.limitsBody}</p>
        </SiteSection>

        <div style={{ marginTop: 52, paddingTop: 32, borderTop: "1px solid var(--rule-on-sheet)" }}>
          <SiteAction href="/how-it-works" tone="outline">
            {copy.research.howLink}
          </SiteAction>
        </div>
      </SiteBody>
    </main>
  );
}
