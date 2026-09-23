"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { messages, type Messages } from "@/lib/i18n";
import { localeFor, type Direction, type Locale } from "@/lib/i18n/locales";

/**
 * The locale, for the half of the product that runs in the browser.
 *
 * Server components call `messages(locale)` directly, because they already
 * have the parent's profile in hand and threading a provider through them
 * would be ceremony. Client components cannot read a cookie at render time
 * without a hydration mismatch, so they read it from here, seeded by a server
 * component that did have the profile.
 *
 * The provider also owns the document's `lang` and `dir`. Those cannot be set
 * from a nested server layout, and they are the difference between an Arabic
 * interface and an Arabic interface laid out backwards.
 */

interface LocaleValue {
  locale: Locale;
  dir: Direction;
  t: Messages;
}

const LocaleContext = createContext<LocaleValue | null>(null);

/** Written by the client so the inline script in the root layout can read it
 *  on the next load and set direction before first paint. */
export const LOCALE_KEY = "pp_locale";

export function LocaleProvider({ code, children }: { code: string | null; children: ReactNode }) {
  const value = useMemo<LocaleValue>(() => {
    const locale = localeFor(code);
    return { locale, dir: locale.dir, t: messages(locale.code) };
  }, [code]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", value.locale.code);
    root.setAttribute("dir", value.dir);
    /* Mirrors how ThemeToggle persists. The root layout is static, because the
       marketing pages are English and should stay cacheable, so the direction
       for the next load comes from here rather than from a cookie read on the
       server. */
    try {
      window.localStorage.setItem(LOCALE_KEY, value.locale.code);
    } catch {
      // Private browsing. The choice holds for this page view and no longer.
    }
  }, [value]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * The locale in scope.
 *
 * Falls back to English rather than throwing when no provider is above it.
 * A missing provider is a wiring mistake that should show up as English copy
 * in one corner of a screen, not as a blank page.
 */
export function useLocale(): LocaleValue {
  const value = useContext(LocaleContext);
  if (value) return value;
  const locale = localeFor(null);
  return { locale, dir: locale.dir, t: messages(locale.code) };
}

/** The catalogue in scope. The common case, so it gets the short name. */
export function useMessages(): Messages {
  return useLocale().t;
}

/** True when the interface is laid out right to left. */
export function useRtl(): boolean {
  return useLocale().dir === "rtl";
}
