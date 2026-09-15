import type { Metadata } from "next";
import Link from "next/link";

import { buttonStyle } from "@/components/ui";
import { copy } from "@/lib/copy";

/**
 * For teachers.
 *
 * Written for someone who has seen homework come back that a parent did, and
 * who is deciding whether this makes that better or worse. So it opens on the
 * thing they are actually worried about rather than on features, and the two
 * sections they will scroll to find, what is stored about their students and
 * what arrives in their inbox, are named rather than buried in a privacy page.
 */

export const metadata: Metadata = {
  title: copy.forTeachers.title,
  description: copy.forTeachers.description,
  openGraph: {
    title: `${copy.forTeachers.title}, ${copy.brand.name}`,
    description: copy.forTeachers.description,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: `${copy.forTeachers.title}, ${copy.brand.name}`,
    description: copy.forTeachers.description,
  },
};

export default function ForTeachersPage() {
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
          <h1 className="pp-display" style={{ color: "var(--text-on-frame)", maxWidth: "17ch" }}>
            {copy.forTeachers.heading}
          </h1>
          <p
            style={{
              marginTop: 20,
              maxWidth: "52ch",
              fontSize: "var(--type-body)",
              color: "var(--text-on-frame-muted)",
            }}
          >
            {copy.forTeachers.intro}
          </p>
        </div>
      </section>

      <div className="pp-desk">
        <div className="pp-sheet-page">
          <section style={{ paddingBottom: 8 }}>
            <h2 style={{ fontSize: "var(--type-h2)", marginBottom: 6 }}>{copy.forTeachers.pointsHeading}</h2>
            <div className="pp-points">
              {copy.forTeachers.points.map((point) => (
                <article key={point.title} className="pp-point">
                  <h3 className="pp-point-title">{point.title}</h3>
                  <p className="pp-point-body">{point.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 24 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.forTeachers.privacyHeading}</h2>
            <p style={{ marginTop: 12, maxWidth: "62ch", lineHeight: 1.65 }}>{copy.forTeachers.privacyBody}</p>
          </section>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 32 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.forTeachers.shareHeading}</h2>
            <p style={{ marginTop: 12, maxWidth: "62ch", lineHeight: 1.65 }}>{copy.forTeachers.shareBody}</p>
          </section>

          <section style={{ borderTop: "1px solid var(--rule-on-sheet)", paddingTop: 32, marginTop: 32 }}>
            <h2 style={{ fontSize: "var(--type-h2)" }}>{copy.forTeachers.ctaHeading}</h2>
            <p style={{ marginTop: 10, maxWidth: "50ch", color: "var(--text-on-sheet-muted)" }}>
              {copy.forTeachers.ctaBody}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
              <Link href="/app" style={{ ...buttonStyle("primary"), display: "inline-block" }}>
                {copy.forTeachers.cta}
              </Link>
              <Link href="/privacy" style={{ ...buttonStyle("secondary"), display: "inline-block" }}>
                {copy.nav.privacy}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
