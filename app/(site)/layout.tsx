import Logo from "@/components/Logo";
import LogoReveal from "@/components/LogoReveal";
import ThemeToggle from "@/components/ThemeToggle";
import { copy } from "@/lib/copy";

/**
 * The marketing surface: teal frame, paper content, one reveal on first load.
 *
 * The product at /app deliberately has none of this. A parent mid-homework
 * does not want a site header, and a 2.6s wordmark reveal in front of a chat
 * thread would be an obstacle rather than an arrival.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LogoReveal />

      {/* The frame. Teal is the desk; content sits on paper within it. */}
      <header
        style={{
          background: "var(--surface-frame-deep)",
          color: "var(--text-on-frame)",
          borderBottom: "1px solid var(--rule-on-frame)",
        }}
      >
        <div
          className="pp-page pp-header-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            paddingBlock: 14,
          }}
        >
          <a href="/" style={{ textDecoration: "none" }} aria-label={copy.brand.name}>
            <Logo size={26} onFrame />
          </a>

          {/* Three questions and one door. Settings, history and the account
              live inside the product, because a visitor who has not opened it
              has nothing to set. */}
          <nav className="pp-nav">
            <a href="/how-it-works">{copy.nav.howItWorks}</a>
            <a href="/research">{copy.nav.research}</a>
            <a href="/for-teachers">{copy.nav.forTeachers}</a>
            <a href="/app" className="pp-nav-cta">
              {copy.nav.openApp}
            </a>
            <ThemeToggle onFrame />
          </nav>
        </div>
      </header>

      {children}

      <footer
        style={{
          background: "var(--surface-frame-deep)",
          color: "var(--text-on-frame-muted)",
          borderTop: "1px solid var(--rule-on-frame)",
        }}
      >
        <div
          className="pp-page"
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            alignItems: "center",
            fontSize: "var(--type-small)",
            paddingBlock: 28,
          }}
        >
          <a href="/privacy">{copy.nav.privacy}</a>
          <a href="/how-it-works">{copy.nav.howItWorks}</a>
          <a href="/research">{copy.nav.research}</a>
          <a href="/for-teachers">{copy.nav.forTeachers}</a>
          <a href="/check">{copy.nav.check}</a>
          <a href="/settings">{copy.nav.settings}</a>
          <span style={{ marginLeft: "auto", maxWidth: "46ch" }}>{copy.landing.noChild}</span>
        </div>
      </footer>
    </>
  );
}
