/**
 * The second of two layers keeping the answer out of a chat reply.
 *
 * The first layer is structural and lives in `lib/ai/provider.ts`: the
 * chat-turn call is the only task in this product that is not given the
 * verified answer, so there is nothing in its context to repeat. That layer
 * is the strong one.
 *
 * This layer covers the case the first cannot: a model that works the answer
 * out for itself and states it anyway. It scans what came back and, on a
 * match, the route drops the model's prose and shows the press-and-hold
 * instead.
 *
 * What it catches: the answer written as digits, with or without spaces
 * around a slash, with a comma or a full stop after it, and small integers
 * written as words. What it does not catch: an equivalent form the answer
 * was not stated in (0.5 for 1/2), a paraphrase that walks the parent to the
 * value without naming it, or a decomposition across two sentences. That is
 * why it is the backstop and not the guarantee.
 *
 * The bias is deliberately toward false positives. Redirecting a parent who
 * did not need redirecting costs them one tap on the answer card. The other
 * error costs them the thing they came here to avoid.
 */

/** 0 through 20 plus the tens, which covers essentially every grade 3 to 6 answer. */
const NUMBER_WORDS: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  "11": "eleven",
  "12": "twelve",
  "13": "thirteen",
  "14": "fourteen",
  "15": "fifteen",
  "16": "sixteen",
  "17": "seventeen",
  "18": "eighteen",
  "19": "nineteen",
  "20": "twenty",
  "30": "thirty",
  "40": "forty",
  "50": "fifty",
  "60": "sixty",
  "70": "seventy",
  "80": "eighty",
  "90": "ninety",
  "100": "one hundred",
};

/** The ordinal a denominator is spoken as: 11/12 is read "eleven twelfths". */
const DENOMINATOR_WORDS: Record<string, string> = {
  "2": "half",
  "3": "third",
  "4": "quarter",
  "5": "fifth",
  "6": "sixth",
  "7": "seventh",
  "8": "eighth",
  "9": "ninth",
  "10": "tenth",
  "11": "eleventh",
  "12": "twelfth",
  "16": "sixteenth",
  "20": "twentieth",
  "100": "hundredth",
};

/**
 * Lowercase, fold unicode lookalikes, and close the gaps a model puts around
 * an operator, so "11 / 12" and "11/12" compare equal.
 */
function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[⁄∕]/g, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips the punctuation an answer field picks up: "11/12." or "= 11/12". */
function core(answer: string): string {
  return normalise(answer)
    .replace(/^[^0-9a-z(-]+/, "")
    .replace(/[.,;:!?\s]+$/, "");
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches only where the needle is not embedded in a longer number or word,
 * so the answer "12" is not found inside "112", "2012" or "twelfths".
 */
function containsToken(haystack: string, needle: string): boolean {
  if (needle === "") return false;
  const before = /[0-9a-z]$/.test(needle[0] ?? "") ? "(?<![0-9a-z.])" : "";
  const after = /[0-9a-z]$/.test(needle[needle.length - 1] ?? "") ? "(?![0-9a-z])" : "";
  return new RegExp(`${before}${escape(needle)}${after}`).test(haystack);
}

/** Every written form of one answer that this guard knows how to look for. */
export function answerForms(answer: string): string[] {
  const value = core(answer);
  if (value === "") return [];

  const forms = new Set<string>([value]);

  const fraction = value.match(/^(-?\d+)\/(\d+)$/);
  if (fraction) {
    const [, top = "", bottom = ""] = fraction;
    const topWord = NUMBER_WORDS[top];
    const bottomWord = DENOMINATOR_WORDS[bottom];
    forms.add(`${top} over ${bottom}`);
    if (topWord && bottomWord) {
      // "one half" and "one quarter" stay singular; everything else pluralises.
      forms.add(top === "1" ? `${topWord} ${bottomWord}` : `${topWord} ${bottomWord}s`);
    }
    return [...forms];
  }

  const whole = value.match(/^-?\d+$/);
  if (whole) {
    const word = NUMBER_WORDS[value.replace("-", "")];
    if (word) forms.add(value.startsWith("-") ? `negative ${word}` : word);
  }

  return [...forms];
}

/**
 * True when `text` states `answer`.
 *
 * An empty or unverified answer returns false: there is no string to look
 * for, and claiming a leak we cannot detect would be worse than admitting
 * the gap. `lib/packet.ts` already blanks `lockedAnswer` when the verifier
 * could not check the arithmetic, so that case arrives here as "".
 */
export function mentionsAnswer(text: string, answer: string | null | undefined): boolean {
  if (!answer) return false;
  const haystack = normalise(text);
  if (haystack === "") return false;
  return answerForms(answer).some((form) => containsToken(haystack, form));
}

/** Runs the guard over every prose field of a chat turn. */
export function chatTurnLeaksAnswer(
  turn: { reply: string; sayThis: string | null; watchFor: string | null },
  answer: string | null | undefined,
): boolean {
  return [turn.reply, turn.sayThis, turn.watchFor].some(
    (field) => field !== null && mentionsAnswer(field, answer),
  );
}
