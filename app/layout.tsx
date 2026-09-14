import type { Metadata, Viewport } from "next";

import Logo from "@/components/Logo";
import LogoReveal from "@/components/LogoReveal";
import { copy } from "@/lib/copy";

import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  themeColor: "#F5F1E8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LogoReveal />

        <header
          style={{
            borderBottom: "1px solid var(--rule)",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <a href="/" style={{ textDecoration: "none" }} aria-label={copy.brand.name}>
            <Logo size={26} />
          </a>
          <nav style={{ display: "flex", gap: 18, fontSize: 15 }}>
            <a href="/capture">{copy.nav.capture}</a>
            <a href="/live">{copy.nav.live}</a>
            <a href="/settings">{copy.nav.settings}</a>
          </nav>
        </header>

        {children}

        <footer
          style={{
            borderTop: "1px solid var(--rule)",
            padding: "26px 20px 40px",
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            fontSize: 15,
            color: "var(--muted)",
          }}
        >
          <a href="/privacy">{copy.nav.privacy}</a>
          <a href="/check">{copy.nav.check}</a>
          <a href="/setup">Set up</a>
          <span style={{ marginLeft: "auto" }}>{copy.landing.noChild}</span>
        </footer>
      </body>
    </html>
  );
}
