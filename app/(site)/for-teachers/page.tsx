import type { Metadata } from "next";

import { SiteAction, SiteBody, SiteHero, SiteSection } from "@/components/site/SitePage";
import { copy } from "@/lib/copy";
import { demoBundle } from "@/lib/demo";

export const metadata: Metadata = { title: "For teachers" };

/**
 * For the person who will never open the app.
 *
 * A teacher's relationship to this product is one artifact: the note a family
 * sends when they stop. So that is the hero, rendered from the same fixture
 * the product serves, rather than a photograph of somebody at a whiteboard.
 *
 * There are no testimonials on this page and there will not be. This product
 * has no teachers using it yet, and quoting one would be inventing a person.
 */
export default async function ForTeachersPage() {
  const demo = await demoBundle("STANDARD");
  const { standard, misconception } = demo;

  return (
    <main>
      <SiteHero
        title={copy.forTeachers.heading}
        standfirst={copy.forTeachers.standfirst}
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
            <p style={{ fontSize: 17, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
              {copy.forTeachers.sampleNote}
            </p>
            <figcaption
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid var(--rule-on-sheet)",
                fontSize: "var(--type-small)",
                color: "var(--text-on-sheet-muted)",
              }}
            >
              {copy.forTeachers.noteCaption}
            </figcaption>
          </figure>
        }
      />

      <SiteBody>
        <SiteSection title={copy.forTeachers.promisesHeading} measure="wide" first>
          <div className="pp-promises">
            {copy.forTeachers.promises.map((promise) => (
              <div key={promise.title} className="pp-promise">
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>{promise.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.6 }}>{promise.body}</p>
              </div>
            ))}
          </div>
        </SiteSection>

        <SiteSection title={copy.forTeachers.noteHeading}>
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>{copy.forTeachers.noteBody}</p>
        </SiteSection>

        <SiteSection title={copy.forTeachers.standardsHeading}>
          <p style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 18 }}>
            {copy.forTeachers.standardsBody}
          </p>

          {/* One real row from the corpus, so "cites the standard" is
              something a teacher can look at rather than take on trust. */}
          <figure
            style={{
              margin: 0,
              padding: "18px 20px",
              border: "1px solid var(--rule-on-sheet)",
              borderLeft: "2px solid var(--annotation)",
            }}
          >
            <p style={{ fontSize: 15, marginBottom: 6 }}>{standard?.code}</p>
            <p style={{ fontSize: 16, lineHeight: 1.6 }}>{standard?.plainLanguage}</p>
            {misconception && (
              <p
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--rule-on-sheet)",
                  fontSize: 15,
                  color: "var(--text-on-sheet-muted)",
                }}
              >
                {copy.forTeachers.misconceptionLabel} {misconception.plainName}
              </p>
            )}
          </figure>
        </SiteSection>

        <SiteSection title={copy.forTeachers.askHeading}>
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>{copy.forTeachers.askBody}</p>
        </SiteSection>

        <div style={{ marginTop: 52, paddingTop: 32, borderTop: "1px solid var(--rule-on-sheet)" }}>
          <SiteAction href="/app">{copy.forTeachers.seeIt}</SiteAction>
        </div>
      </SiteBody>
    </main>
  );
}
