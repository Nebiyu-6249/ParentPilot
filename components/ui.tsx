import type { CSSProperties, ReactNode } from "react";

/**
 * The handful of shared primitives.
 *
 * Deliberately small. This design system is mostly hairlines, vertical
 * rhythm and one accent colour, so most screens compose from these four
 * pieces plus plain elements.
 */

/**
 * A content screen: a sheet of paper lying on the desk.
 *
 * `surface="desk"` opts out for Live Mode, which is not a document and should
 * not be a lit rectangle in a dim room.
 */
export function Page({
  children,
  style,
  surface = "sheet",
}: {
  children: ReactNode;
  style?: CSSProperties;
  surface?: "sheet" | "desk";
}) {
  if (surface === "desk") {
    return (
      <main className="pp-desk-page" style={style}>
        {children}
      </main>
    );
  }

  return (
    <div className="pp-desk">
      <main className="pp-sheet-page" style={style}>
        {children}
      </main>
    </div>
  );
}

/** A titled block, separated from its neighbour by a hairline. */
export function Section({
  title,
  children,
  note,
}: {
  title?: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <section style={{ borderTop: "1px solid var(--rule)", padding: "36px 0" }}>
      {title && (
        <h2 style={{ marginBottom: note ? 8 : 20, fontSize: "1.35rem" }}>{title}</h2>
      )}
      {note && (
        <p style={{ color: "var(--muted)", fontSize: 15, marginBottom: 20 }}>{note}</p>
      )}
      {children}
    </section>
  );
}

export function Hairline() {
  return <hr />;
}

type ButtonVariant = "primary" | "secondary" | "quiet" | "alert";

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  // Actions are teal. Emerald is the pen, not a button fill.
  primary: { background: "var(--action)", color: "var(--action-label)", border: "1px solid var(--action)" },
  secondary: { background: "transparent", color: "var(--action)", border: "1px solid var(--action)" },
  quiet: { background: "transparent", color: "var(--muted)", border: "1px solid var(--border-interactive)" },
  alert: { background: "var(--alert)", color: "var(--action-label)", border: "1px solid var(--alert)" },
};

export function buttonStyle(variant: ButtonVariant = "primary", full = false): CSSProperties {
  return {
    ...VARIANTS[variant],
    padding: "15px 22px",
    fontSize: 17,
    fontWeight: 500,
    width: full ? "100%" : undefined,
    transition: "background 200ms ease-out, color 200ms ease-out",
  };
}

/**
 * Primary actions sit at the bottom of the viewport, thumb-reachable.
 * Sticky rather than fixed so it never covers the end of the content.
 */
export function ThumbBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "var(--paper)",
        borderTop: "1px solid var(--rule)",
        padding: "14px 0 20px",
        marginTop: 32,
        display: "flex",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

/** An honest banner. Used for degraded paths, never for an error page. */
export function Banner({ text, tone = "quiet" }: { text: string; tone?: "quiet" | "alert" }) {
  return (
    <p
      role="status"
      style={{
        border: `1px solid ${tone === "alert" ? "var(--alert)" : "var(--rule)"}`,
        color: tone === "alert" ? "var(--alert)" : "var(--muted)",
        padding: "12px 14px",
        fontSize: 15,
        margin: "20px 0",
        maxWidth: "none",
      }}
    >
      {text}
    </p>
  );
}

/**
 * A small label above a field or a column.
 *
 * Sentence case. It was tracked-out capitals, which is the round two tell, and
 * because every product screen takes its labels from here it was the tell in
 * about ten places at once: "GRADE 5" over a worksheet, "ASK THIS, THEN WAIT"
 * over the question. The thread's own cards stopped shouting in step three and
 * this is the rest of them.
 */
export function Label({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 13,
        color: "var(--muted)",
        marginBottom: 8,
      }}
    >
      {children}
    </span>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  border: "1px solid var(--border-interactive)",
  background: "var(--paper)",
  color: "var(--ink)",
  fontSize: 17,
  lineHeight: 1.5,
};
