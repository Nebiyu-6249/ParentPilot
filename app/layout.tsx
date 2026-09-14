import type { Metadata, Viewport } from "next";

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

/**
 * The root layout carries the document and nothing else.
 *
 * There are two surfaces and they do not share chrome: the marketing site in
 * app/(site) has the teal header and footer, and the product at /app is a
 * full-height chat shell with neither. A route group keeps both at their
 * existing URLs; (site) contributes no path segment.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Public+Sans:wght@400;500;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
