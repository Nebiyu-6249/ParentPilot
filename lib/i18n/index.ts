/**
 * The message catalogue.
 *
 *   messages("ar").chat.composerPlaceholder
 *
 * English is the canonical set and every other locale is an overlay carrying
 * only what it translates. Two reasons, and the second is the one that
 * matters:
 *
 *   1. A string added in English is never silently missing elsewhere. It is
 *      visibly English until someone writes it, which is a bug a person can
 *      see rather than an empty span.
 *   2. The launch locales translate the product surface and not the marketing
 *      pages. An overlay expresses that directly. A set of four complete
 *      files would express it by duplicating 231 lines of English prose three
 *      times and hoping nobody edits one of the copies.
 *
 * **The voice is rewritten, not translated.** Each overlay is written in its
 * own register by someone thinking in that language. The English copy says
 * "Ask this, then wait", which is a particular kind of English understatement;
 * the Arabic is not that sentence in Arabic, it is the sentence an Arabic
 * speaking parent would find plain. Translating the voice literally produces
 * copy that is correct and sounds like a form.
 */

import { en } from "@/lib/i18n/messages/en";
import { ar } from "@/lib/i18n/messages/ar";
import { am } from "@/lib/i18n/messages/am";
import { es } from "@/lib/i18n/messages/es";
import { DEFAULT_LOCALE, localeFor } from "@/lib/i18n/locales";

export type Messages = typeof en;

/**
 * What an overlay may carry.
 *
 * Recursive, and it stops at arrays: an overlay replaces an array wholesale
 * rather than merging it element by element. Merging would mean a locale that
 * translates two of three register labels silently gets the third in English
 * in the middle of a control, which is worse than either whole answer.
 */
export type LocaleOverlay = {
  [K in keyof Messages]?: Messages[K] extends readonly unknown[]
    ? Messages[K]
    : Messages[K] extends object
      ? { [J in keyof Messages[K]]?: Messages[K][J] }
      : Messages[K];
};

const OVERLAYS: Record<string, LocaleOverlay> = { ar, am, es };

/** Two levels deep, which is exactly how deep the catalogue goes. */
function overlay(base: Messages, patch: LocaleOverlay): Messages {
  const out: Record<string, unknown> = { ...base };

  for (const [section, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const existing = out[section];
    if (
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing) &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[section] = { ...existing, ...value };
    } else {
      out[section] = value;
    }
  }

  return out as Messages;
}

const cache = new Map<string, Messages>();

/**
 * The catalogue for a locale.
 *
 * Falls back to English for an unknown tag rather than throwing, for the same
 * reason `localeFor` does: this reads a column a browser once wrote, and a
 * stale tag must not take a page down. Memoised, because it is called on every
 * render of every server component and the merge is pure.
 */
export function messages(code: string | null | undefined): Messages {
  const locale = localeFor(code);
  const cached = cache.get(locale.code);
  if (cached) return cached;

  const patch = OVERLAYS[locale.code];
  const built = patch ? overlay(en, patch) : en;
  cache.set(locale.code, built);
  return built;
}

/**
 * How much of a locale is actually written, as a fraction of English.
 *
 * Shown on /ops and asserted in the check suite. A catalogue that quietly
 * rots back towards English is the failure mode of every overlay scheme, and
 * the only defence is a number somebody looks at.
 */
export function coverage(code: string): { translated: number; total: number; sections: string[] } {
  const locale = localeFor(code);
  const total = countStrings(en);

  // English is the catalogue, so it is complete by definition rather than by
  // having an overlay. Reporting it as 0% would be the most misleading number
  // on the page.
  if (locale.code === DEFAULT_LOCALE) return { translated: total, total, sections: Object.keys(en) };

  const patch = OVERLAYS[locale.code];
  const sections = Object.keys(en);

  if (!patch) return { translated: 0, total, sections: [] };

  let translated = 0;
  for (const section of sections) {
    const value = (patch as Record<string, unknown>)[section];
    if (value !== undefined) translated += countStrings(value);
  }

  return { translated, total, sections: Object.keys(patch) };
}

function countStrings(value: unknown): number {
  if (typeof value === "string") return 1;
  if (Array.isArray(value)) return value.reduce<number>((sum, v) => sum + countStrings(v), 0);
  if (value && typeof value === "object") {
    return Object.values(value).reduce<number>((sum, v) => sum + countStrings(v), 0);
  }
  return 0;
}

export { DEFAULT_LOCALE };
export type { Locale, Direction, NumberProfile } from "@/lib/i18n/locales";
export { LOCALES, TRANSLATED_LOCALES, localeFor, isRtl, directionOf } from "@/lib/i18n/locales";
export { formatNumber, formatPercent, localiseExpression } from "@/lib/i18n/numbers";
