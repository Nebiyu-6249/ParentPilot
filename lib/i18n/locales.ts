/**
 * The locale registry.
 *
 * One table, because a locale is more than a language tag here. It carries
 * the direction the page flows, the script the fonts have to cover, and the
 * notation a child's maths textbook actually uses, and those three things
 * disagree with each other often enough that guessing any of them from the
 * tag is wrong.
 *
 * Two different questions use this table and they are not the same question:
 *
 *   1. What language does the model write in? Any of these, plus anything
 *      else a parent types, because that is a line in a prompt.
 *   2. What language is the interface in? Only the locales with a message
 *      catalogue. `translated` says which.
 *
 * Conflating them is how a product ends up with a language picker offering
 * twelve options and an interface that silently stays English in eleven.
 */

export type Direction = "ltr" | "rtl";

/** Which font stack has to cover this locale. */
export type Script = "latin" | "arabic" | "ethiopic";

/**
 * How numbers are written where this child goes to school.
 *
 * Applied to numbers **the product generates**: a count, a step number, a
 * measurement in a script. Never applied to `printedText` or to a child's
 * transcribed working, which stay exactly as they were written on the page.
 * Re-notating a transcription would mean showing a parent something their
 * child did not write, which is the one thing the reading step promises not
 * to do.
 */
export interface NumberProfile {
  /** Separates the whole part from the fraction. */
  decimal: string;
  /** Groups thousands. Empty string for locales that group with nothing. */
  thousands: string;
  /** The division sign as the textbook prints it. */
  division: string;
  /** The multiplication sign as the textbook prints it. */
  multiplication: string;
  percent: string;
  /**
   * Which digits. `latn` is 0123456789, `arab` is the Eastern Arabic-Indic
   * set ٠١٢٣٤٥٦٧٨٩ used in Egypt, Sudan, the Levant and the Gulf.
   */
  digits: "latn" | "arab";
}

export interface Locale {
  code: string;
  /** The name in its own language, which is what a picker should show. */
  endonym: string;
  /** The name in English, for an English-speaking admin reading a log. */
  english: string;
  dir: Direction;
  script: Script;
  numbers: NumberProfile;
  /** True when a message catalogue exists. False means the model writes in
   *  this language but the interface is English. */
  translated: boolean;
}

const LATIN_POINT: NumberProfile = {
  decimal: ".",
  thousands: ",",
  division: "÷",
  multiplication: "×",
  percent: "%",
  digits: "latn",
};

export const LOCALES: readonly Locale[] = [
  {
    code: "en",
    endonym: "English",
    english: "English",
    dir: "ltr",
    script: "latin",
    numbers: LATIN_POINT,
    translated: true,
  },
  {
    code: "es",
    endonym: "Español",
    english: "Spanish",
    dir: "ltr",
    script: "latin",
    /* Spain's convention: comma for the decimal, point for thousands. Mexico
       and most of Central America do the opposite, and a Mexican child's
       textbook will not match this. That is a real split and the fix is a
       second entry here keyed `es-MX`, not a compromise that matches neither.
       Spain first because it is the larger share of the launch. */
    numbers: {
      decimal: ",",
      thousands: ".",
      division: "÷",
      multiplication: "×",
      percent: "%",
      digits: "latn",
    },
    translated: true,
  },
  {
    code: "ar",
    endonym: "العربية",
    english: "Arabic",
    dir: "rtl",
    script: "arabic",
    /* Arabic-Indic digits with their own separators: U+066B decimal, U+066C
       thousands, U+066A percent. This is the Mashriq and Gulf convention and
       it is what a school textbook in Cairo or Riyadh prints. The Maghreb
       uses Western digits throughout, which is again a second entry rather
       than a compromise. */
    numbers: {
      decimal: "٫",
      thousands: "٬",
      division: "÷",
      multiplication: "×",
      percent: "٪",
      digits: "arab",
    },
    translated: true,
  },
  {
    code: "am",
    endonym: "አማርኛ",
    english: "Amharic",
    dir: "ltr",
    script: "ethiopic",
    /* Ethiopic has its own numerals and they are not used for arithmetic.
       Ethiopian maths textbooks print Western digits, so this is a Latin
       number profile attached to a non-Latin script, which is exactly why
       script and notation are separate fields. */
    numbers: LATIN_POINT,
    translated: true,
  },

  /* Below here the model writes in the language and the interface stays
     English. They are in the table rather than in a second list so that the
     picker can say so rather than implying a translation that is not there. */
  { code: "fr", endonym: "Français", english: "French", dir: "ltr", script: "latin", numbers: { decimal: ",", thousands: " ", division: "÷", multiplication: "×", percent: "%", digits: "latn" }, translated: false },
  { code: "pt", endonym: "Português", english: "Portuguese", dir: "ltr", script: "latin", numbers: { decimal: ",", thousands: ".", division: "÷", multiplication: "×", percent: "%", digits: "latn" }, translated: false },
  { code: "zh", endonym: "中文", english: "Chinese", dir: "ltr", script: "latin", numbers: LATIN_POINT, translated: false },
  { code: "hi", endonym: "हिन्दी", english: "Hindi", dir: "ltr", script: "latin", numbers: LATIN_POINT, translated: false },
  { code: "so", endonym: "Soomaali", english: "Somali", dir: "ltr", script: "latin", numbers: LATIN_POINT, translated: false },
  { code: "ur", endonym: "اردو", english: "Urdu", dir: "rtl", script: "arabic", numbers: LATIN_POINT, translated: false },
] as const;

export const DEFAULT_LOCALE = "en";

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));

/** Every locale whose interface is actually translated. */
export const TRANSLATED_LOCALES: readonly Locale[] = LOCALES.filter((l) => l.translated);

/**
 * The locale for a stored language tag.
 *
 * Falls back to English rather than throwing, because this reads a column a
 * parent's browser once wrote into and a tag that has since been removed from
 * the table must not take a page down. A regional tag resolves to its base
 * language, so `es-MX` finds `es` until there is an `es-MX` row of its own.
 */
export function localeFor(code: string | null | undefined): Locale {
  if (!code) return BY_CODE.get(DEFAULT_LOCALE) as Locale;
  const exact = BY_CODE.get(code);
  if (exact) return exact;
  const base = code.split(/[-_]/)[0];
  return BY_CODE.get(base ?? "") ?? (BY_CODE.get(DEFAULT_LOCALE) as Locale);
}

export function isRtl(code: string | null | undefined): boolean {
  return localeFor(code).dir === "rtl";
}

export function directionOf(code: string | null | undefined): Direction {
  return localeFor(code).dir;
}
