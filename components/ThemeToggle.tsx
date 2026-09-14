"use client";

import { useEffect, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/icons";

/**
 * Light and dark, defaulting to the system preference.
 *
 * The stored choice is applied by an inline script in `app/layout.tsx` before
 * first paint, so this component only has to reflect and change it. It renders
 * nothing until mounted, because the server cannot know what `localStorage`
 * says and a guess would flash the wrong icon.
 */

export const THEME_KEY = "pp_theme";
export type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function currentTheme(): Theme {
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped === "light" || stamped === "dark") return stamped;
  return systemTheme();
}

export default function ThemeToggle({ onFrame = false }: { onFrame?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggle(): void {
    const next: Theme = (theme ?? currentTheme()) === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing. The choice holds for this page view and no longer.
    }
  }

  // Reserve the space so the header does not shift when this mounts.
  if (theme === null) {
    return <span style={{ display: "inline-block", width: 38, height: 38 }} aria-hidden="true" />;
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        background: "transparent",
        border: `1px solid ${onFrame ? "var(--border-interactive-frame)" : "var(--border-interactive)"}`,
        color: onFrame ? "var(--text-on-frame)" : "var(--text-on-sheet)",
        transition: "border-color 200ms ease-out",
      }}
    >
      {theme === "dark" ? <SunIcon size={19} /> : <MoonIcon size={19} />}
    </button>
  );
}
