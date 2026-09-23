/**
 * Numbers, written the way the child's textbook writes them.
 *
 * `Intl.NumberFormat` is not used here, deliberately. It formats numbers for
 * a *reader*, which is a different job from matching a *textbook*: it will
 * give Egyptian Arabic western digits or eastern ones depending on the exact
 * tag and the runtime's ICU build, and it has no opinion at all about whether
 * division is written with an obelus or a colon. Those are the two things
 * this product needs to get right and the two things Intl will not commit to,
 * so the profile in `locales.ts` states them and this renders them.
 *
 * **What this does not touch.** A problem's `printedText` and a child's
 * transcribed working are never passed through here. They are a record of
 * what was on the page, and re-notating them would show a parent something
 * their child did not write. The reading step promises not to do that, and
 * the promise is worth more than consistent punctuation.
 */

import { localeFor, type NumberProfile } from "@/lib/i18n/locales";

/** Eastern Arabic-Indic digits, in value order. */
const ARAB_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Rewrites the ASCII digits in a string into the profile's digit set. */
function toDigits(text: string, profile: NumberProfile): string {
  if (profile.digits === "latn") return text;
  return text.replace(/[0-9]/g, (d) => ARAB_DIGITS[Number(d)] ?? d);
}

/**
 * Groups the integer part in threes.
 *
 * Hand rolled rather than via a regular expression with a lookahead, because
 * the separator can be a thin space and the usual `\B(?=(\d{3})+(?!\d))`
 * trick is harder to read than the loop once you have to reason about what it
 * does to a four digit year.
 */
function group(digits: string, separator: string): string {
  if (separator === "" || digits.length <= 3) return digits;
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    const fromEnd = digits.length - i;
    out += digits[i];
    if (fromEnd > 1 && (fromEnd - 1) % 3 === 0) out += separator;
  }
  return out;
}

export interface NumberOptions {
  /** Fixed decimal places. Omitted means "as many as the value has". */
  decimals?: number;
  /** Thousands grouping. Off for things that are not quantities, such as a
   *  year or a step number, where grouping reads as a typo. */
  grouped?: boolean;
}

/**
 * One number, in this locale's notation.
 *
 *   formatNumber(1234.5, "en")  -> "1,234.5"
 *   formatNumber(1234.5, "es")  -> "1.234,5"
 *   formatNumber(1234.5, "ar")  -> "١٬٢٣٤٫٥"
 */
export function formatNumber(value: number, locale: string, options: NumberOptions = {}): string {
  const profile = localeFor(locale).numbers;
  if (!Number.isFinite(value)) return "";

  const negative = value < 0;
  const absolute = Math.abs(value);

  const fixed = options.decimals === undefined ? String(absolute) : absolute.toFixed(options.decimals);
  const [whole = "0", fraction] = fixed.split(".");

  const grouped = options.grouped === false ? whole : group(whole, profile.thousands);
  const joined = fraction === undefined ? grouped : `${grouped}${profile.decimal}${fraction}`;

  return toDigits(negative ? `-${joined}` : joined, profile);
}

/** A percentage, with the locale's own percent sign. */
export function formatPercent(value: number, locale: string, decimals = 0): string {
  const profile = localeFor(locale).numbers;
  return `${formatNumber(value, locale, { decimals, grouped: false })}${profile.percent}`;
}

/**
 * The operators in a short expression the product wrote itself.
 *
 * For a worked example or an isomorph that the model produced in ASCII, so
 * that `3 x 4` prints as `3 × 4` and division as whatever the textbook uses.
 * Not for a transcription: see the note at the top of this file.
 *
 * Digits are converted too, because an expression the product generated is
 * the product's own prose rather than a record of the page.
 */
export function localiseExpression(text: string, locale: string): string {
  const profile = localeFor(locale).numbers;
  return toDigits(
    text
      // `x` only between digits, so "box" and "six" survive.
      .replace(/(\d)\s*[x×*]\s*(\d)/g, `$1 ${profile.multiplication} $2`)
      .replace(/(\d)\s*[÷]\s*(\d)/g, `$1 ${profile.division} $2`)
      .replace(/(\d)%/g, `$1${profile.percent}`),
    profile,
  );
}

/**
 * Pluralisation is deliberately not here.
 *
 * Arabic has a dual and more than one plural form, and Amharic marks
 * plurality differently again. A helper that took a count and a noun and
 * tried to decline it would produce confident nonsense in two of the four
 * launch locales. The catalogues carry the forms they need as separate
 * strings, and this module only ever places the digits.
 */
