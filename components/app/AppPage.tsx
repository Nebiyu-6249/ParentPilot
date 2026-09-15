import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { ChevronIcon } from "@/components/icons";
import { copy } from "@/lib/copy";

/**
 * A settled page on the product surface.
 *
 * The thread is where a parent works; these are the places they go to change
 * something and come straight back. So the chrome is the thread's chrome with
 * the composer removed: same rail-coloured bar, same 740px column, same
 * tokens. What it deliberately does not have is the marketing site's teal
 * frame and its footer full of links, which on the way back from Settings is
 * an invitation to wander rather than to return.
 *
 * The bar's leading control is a way back to the thread, not a logo that
 * happens to be clickable. A parent who came here from a half-worked problem
 * should be one obvious tap from it.
 */
export function AppPage({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  /** For screens whose content is a grid rather than a column. */
  wide?: boolean;
}) {
  return (
    <div className="pp-appview">
      <header className="pp-topbar">
        <Link href="/app" className="pp-back" aria-label={copy.common.backToThread}>
          <ChevronIcon direction="left" size={16} />
          <span className="pp-back-label">{copy.common.backToThread}</span>
        </Link>

        <span className="pp-topbar-title">{title}</span>

        <div className="pp-topbar-actions">
          <Link href="/" aria-label={copy.brand.name} style={{ display: "flex", textDecoration: "none" }}>
            <Logo size={20} on="app" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="pp-appview-scroll">
        <main className="pp-appview-inner" style={wide ? { maxWidth: 960 } : undefined}>
          <h1 className="pp-appview-title">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}

/** A titled block, divided from its neighbour the way the thread's cards are. */
export function AppSection({
  title,
  note,
  children,
  style,
}: {
  title?: string;
  note?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section className="pp-appview-section" style={style}>
      {title && <h2 className="pp-appview-h2">{title}</h2>}
      {note && <p className="pp-appview-note">{note}</p>}
      {children}
    </section>
  );
}

export type AppButtonVariant = "primary" | "secondary" | "quiet" | "alert";

/**
 * A control on the product surface.
 *
 * Emerald fills the primary, which is the one place the app layer spends the
 * brand. The site surface keeps its own deep teal `--action`, because there
 * the brand is already the ground and a filled emerald button on it would be
 * a mark, not an action.
 */
export function appButton(variant: AppButtonVariant = "primary", full = false): CSSProperties {
  const base: CSSProperties = {
    display: full ? "flex" : "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: full ? "100%" : undefined,
    padding: "11px 18px",
    borderRadius: "var(--r-control)",
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 120ms ease-out",
  };

  if (variant === "primary") {
    return {
      ...base,
      background: "var(--accent-fill)",
      border: "1px solid var(--accent-fill)",
      color: "#ffffff",
    };
  }
  if (variant === "alert") {
    return {
      ...base,
      background: "transparent",
      border: "1px solid var(--app-alert-ink)",
      color: "var(--app-alert-ink)",
    };
  }
  if (variant === "quiet") {
    return { ...base, background: "transparent", border: "1px solid transparent", color: "var(--app-text-dim)" };
  }
  return {
    ...base,
    background: "transparent",
    border: "1px solid var(--app-border-interactive)",
    color: "var(--app-text)",
  };
}

export const appInput: CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: "var(--r-control)",
  border: "1px solid var(--app-border-interactive)",
  background: "var(--app-card)",
  color: "var(--app-text)",
  fontSize: 15,
  fontFamily: "inherit",
};

/** A short line of explanation under a control, in the dim text colour. */
export function AppNote({ children }: { children: ReactNode }) {
  return <p className="pp-appview-note">{children}</p>;
}

/** A small label above a value or a control. */
export function AppLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        fontSize: 12.5,
        fontWeight: 500,
        color: "var(--app-text-dim)",
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Something the parent needs to read before carrying on.
 *
 * Two tones and no icons. The alert tone borrows the degradation colours the
 * thread already uses for a notice card, so "this did not work" looks the same
 * wherever a parent meets it.
 */
export function AppBanner({ text, tone = "quiet" }: { text: string; tone?: "quiet" | "alert" }) {
  const alert = tone === "alert";
  return (
    <p
      role={alert ? "alert" : "status"}
      style={{
        margin: "0 0 18px",
        padding: "12px 15px",
        borderRadius: "var(--r-card)",
        border: `1px solid ${alert ? "var(--app-alert-line)" : "var(--app-line)"}`,
        background: alert ? "var(--app-alert-bg)" : "var(--app-card)",
        color: alert ? "var(--app-alert-ink)" : "var(--app-text)",
        fontSize: 14.5,
        lineHeight: 1.55,
      }}
    >
      {text}
    </p>
  );
}
