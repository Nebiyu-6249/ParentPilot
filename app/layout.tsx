import type { Metadata, Viewport } from "next";

import Logo from "@/components/Logo";
import LogoReveal from "@/components/LogoReveal";
import ThemeToggle from "@/components/ThemeToggle";
import { resolveAppUrl } from "@/lib/app-url";
import { copy } from "@/lib/copy";

import "./globals.css";

// Never read NEXT_PUBLIC_APP_URL directly here. On Vercel it is frequently
// defined but empty, and `new URL("")` throws at module scope, which fails the
// production build rather than one request. See lib/app-url.ts.
const appUrl = resolveAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${copy.brand.name}, ${copy.brand.tagline}`,
    template: `%s, ${copy.brand.name}`,
  },
  description: copy.landing.thesis,
  openGraph: {
    title: copy.brand.name,
    description: copy.landing.thesis,
    url: appUrl,
    siteName: copy.brand.name,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: copy.brand.name, description: copy.landing.thesis },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B4F4A" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1614" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Applied before first paint so a parent who chose dark does not get a frame
 * of cream. Kept deliberately tiny and dependency-free: it runs ahead of
 * everything, so a throw here would be a blank page.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("pp_theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Public+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
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

            <nav className="pp-nav">
              <a href="/capture">{copy.nav.capture}</a>
              <a href="/live">{copy.nav.live}</a>
              <a href="/settings">{copy.nav.settings}</a>
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
            <a href="/check">{copy.nav.check}</a>
            <a href="/history">{copy.history.heading}</a>
            <a href="/account">{copy.account.heading}</a>
            <a href="/setup">Set up</a>
            <span style={{ marginLeft: "auto", maxWidth: "46ch" }}>{copy.landing.noChild}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
