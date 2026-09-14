import type { CSSProperties, ReactNode } from "react";

/**
 * The shape every marketing page takes.
 *
 * Teal band on top carrying the page's opening, paper underneath carrying its
 * content. That is the round two direction held across four pages rather than
 * one: the desk is the frame, the paper is where reading happens, and the
 * boundary between them is where a visitor stops skimming and starts reading.
 *
 * The opening is a question or a claim, never a slogan over a stock idea. Each
 * page below answers its own opening with a real artifact from the product.
 */
export function SiteHero({
  title,
  standfirst,
  aside,
  children,
}: {
  title: string;
  standfirst?: string;
  /** Sits beside the title on wide screens. Usually a real artifact. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--surface-frame)",
        color: "var(--text-on-frame)",
        borderBottom: "1px solid var(--rule-on-frame)",
      }}
    >
      <div className="pp-page" style={{ paddingBlock: "clamp(40px, 6vw, 76px)" }}>
        {/* With an artifact beside it, the headline takes the narrow column.
            Without one, headline and standfirst become the two columns
            themselves, so the band is composed rather than half empty. */}
        <div className={aside ? "pp-hero-grid" : "pp-hero-cover"}>
          <div>
            {/* One line, one weight, one colour. No eyebrow above it and no
                single accented word inside it. */}
            <h1 className="pp-display" style={{ color: "var(--text-on-frame)", maxWidth: "19ch" }}>
              {title}
            </h1>

            {aside && standfirst && (
              <p className="pp-hero-standfirst" style={{ marginTop: 20 }}>
                {standfirst}
              </p>
            )}

            {children}
          </div>

          {aside}

          {!aside && standfirst && (
            <p className="pp-hero-standfirst pp-hero-standfirst-cover">{standfirst}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Paper. Everything a visitor is meant to read sits here. */
export function SiteBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="pp-page"
      style={{
        background: "var(--surface-sheet)",
        color: "var(--text-on-sheet)",
        maxWidth: "none",
        paddingBlock: "clamp(40px, 5vw, 64px)",
        ...style,
      }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

/**
 * One block of reading, ruled off from the next.
 *
 * `measure` caps the line length; the default is the one the body face wants.
 * A block that holds a table or a pair of columns passes "wide" and takes the
 * whole grid.
 */
export function SiteSection({
  title,
  children,
  measure = "read",
  first = false,
}: {
  title?: string;
  children: ReactNode;
  measure?: "read" | "wide";
  first?: boolean;
}) {
  return (
    <section
      style={{
        maxWidth: measure === "wide" ? "none" : 760,
        marginTop: first ? 0 : 48,
        paddingTop: first ? 0 : 32,
        borderTop: first ? undefined : "1px solid var(--rule-on-sheet)",
      }}
    >
      {title && <h2 style={{ marginBottom: 16 }}>{title}</h2>}
      {children}
    </section>
  );
}

/** A link styled as the page's one heavy action. Teal fill on paper. */
export function SiteAction({
  href,
  children,
  tone = "solid",
}: {
  href: string;
  children: ReactNode;
  tone?: "solid" | "outline";
}) {
  const shared: CSSProperties = {
    display: "inline-block",
    padding: "15px 26px",
    fontSize: 17,
    fontWeight: 500,
    textDecoration: "none",
  };

  return (
    <a
      href={href}
      style={
        tone === "solid"
          ? {
              ...shared,
              background: "var(--action)",
              color: "var(--action-label)",
              border: "1px solid var(--action)",
            }
          : {
              ...shared,
              background: "transparent",
              color: "var(--text-on-sheet)",
              border: "1px solid var(--border-interactive)",
            }
      }
    >
      {children}
    </a>
  );
}
