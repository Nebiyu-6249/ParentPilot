import { create, all, type MathJsInstance, type Fraction } from "mathjs";

/**
 * Independent answer verification.
 *
 * Nothing in this file asks a model anything. The arithmetic is recomputed
 * from the printed question using exact rational arithmetic, and the result
 * is compared against whatever the model claimed. That comparison is the
 * only thing standing between a parent and a confidently wrong answer, so it
 * is deliberately conservative: when the two disagree, the answer is
 * suppressed rather than shown with a hedge.
 */

/**
 * A mathjs instance configured so that every literal parses as an exact
 * `Fraction`. This is what makes `1/4 + 2/3` come back as `11/12` rather
 * than `0.9166666666666666`, and what makes `0.1 + 0.2` come back as
 * `3/10` rather than `0.30000000000000004`.
 */
const math: MathJsInstance = create(all, { number: "Fraction" });

export type VerificationStatus = "checked" | "unverified" | "not-applicable";

export interface Verification {
  status: VerificationStatus;
  /** Our own computed answer, when the expression was computable. */
  computedAnswer: string | null;
  /** Short reason, shown to nobody but useful in logs and /ops. */
  detail: string;
}

const NOT_APPLICABLE: Verification = {
  status: "not-applicable",
  computedAnswer: null,
  detail: "No arithmetic expression could be isolated from the question.",
};

/**
 * Turns worksheet notation into something the parser accepts.
 *
 * Worksheets use `×`, `÷`, `x` and unicode minus, number the questions, and
 * put the child's attempt after an `=`. All of that has to go before the
 * expression can be evaluated.
 */
function normalise(raw: string): string {
  let s = raw.trim();

  // Drop a leading question number: "3. ", "3) ", "Q3 ".
  s = s.replace(/^\s*(?:q\s*)?\d{1,2}\s*[.)]\s+/i, "");

  // Everything from the first `=` onwards is the answer slot, not the
  // question. Keeping it would make the verifier grade the child's attempt.
  const eq = s.indexOf("=");
  if (eq !== -1) s = s.slice(0, eq);

  s = s
    .replace(/[×⋅•]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/[,]/g, "") // thousands separators
    .replace(/\$/g, "")
    .replace(/\?/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // `x` between two numbers is a multiplication cross, not a variable.
  s = s.replace(/(\d)\s*[xX]\s*(?=[\d(])/g, "$1 * ");

  // Mixed numbers: `1 1/2` is one and a half, not one times a half.
  s = s.replace(/(?<![\d/.])(\d+)\s+(\d+)\s*\/\s*(\d+)/g, "($1 + $2/$3)");

  // `20% of 60` and bare percentages.
  s = s.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s+/gi, "($1/100) * ");
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");

  return s.trim();
}

/** True when the normalised string is arithmetic and nothing else. */
function isPureArithmetic(s: string): boolean {
  if (!s) return false;
  if (!/\d/.test(s)) return false;
  // At least one operator, otherwise there is nothing to compute.
  if (!/[+\-*/^]/.test(s)) return false;
  return /^[\d\s+\-*/^().]+$/.test(s);
}

function isFraction(value: unknown): value is Fraction {
  return typeof value === "object" && value !== null && "n" in value && "d" in value;
}

/** Formats an exact result, preferring the notation the question used. */
function formatResult(value: Fraction, preferDecimal: boolean): string {
  const asNumber = math.number(value) as number;

  if (preferDecimal) {
    // Round away float noise without inventing precision.
    const rounded = Number(asNumber.toFixed(6));
    return String(rounded);
  }

  const fractionText = math.format(value, { fraction: "ratio" });
  // `math.format` renders whole numbers as `3/1`.
  return typeof fractionText === "string" ? fractionText.replace(/^(-?\d+)\/1$/, "$1") : String(asNumber);
}

/**
 * Recomputes the answer to a printed question using exact arithmetic.
 *
 * Returns `null` when the question is not a bare computation, which includes
 * every word problem. That is not a failure, it just means there is nothing
 * here to check.
 */
export function computeAnswer(printedText: string): string | null {
  const normalised = normalise(printedText);
  if (!isPureArithmetic(normalised)) return null;

  try {
    const result: unknown = math.evaluate(normalised);
    if (!isFraction(result)) {
      if (typeof result === "number" && Number.isFinite(result)) return String(result);
      return null;
    }
    // If the question was written in decimals, answer in decimals.
    const preferDecimal = /\d\.\d/.test(normalised) && !/\//.test(printedText);
    return formatResult(result, preferDecimal);
  } catch {
    return null;
  }
}

/** Pulls every number, fraction and mixed number out of a free-text answer. */
function numericTokens(text: string): Fraction[] {
  const tokens: Fraction[] = [];
  const pattern = /(-?\d+\s+\d+\s*\/\s*\d+)|(-?\d+\s*\/\s*\d+)|(-?\d+\.\d+)|(-?\d+)/g;

  for (const match of text.replace(/,/g, "").matchAll(pattern)) {
    const raw = match[0].trim();
    try {
      const mixed = raw.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
      if (mixed) {
        const [, whole, num, den] = mixed;
        const value = math.evaluate(`(${whole} + ${num}/${den})`) as unknown;
        if (isFraction(value)) tokens.push(value);
        continue;
      }
      const value = math.evaluate(raw.replace(/\s+/g, "")) as unknown;
      if (isFraction(value)) tokens.push(value);
    } catch {
      // Unparseable token, skip it.
    }
  }

  return tokens;
}

/** Counts decimal places, used to allow for a legitimately rounded answer. */
function decimalPlaces(text: string): number {
  const match = text.match(/\d+\.(\d+)/);
  return match?.[1]?.length ?? 0;
}

function sameValue(computed: Fraction, candidate: Fraction, claimedText: string): boolean {
  if (math.equal(computed, candidate) === true) return true;

  // A decimal answer may legitimately be a rounding of an exact fraction.
  const places = decimalPlaces(claimedText);
  if (places > 0 && places <= 6) {
    const a = math.number(computed) as number;
    const b = math.number(candidate) as number;
    if (Math.abs(a - b) <= 0.5 * 10 ** -places + Number.EPSILON) return true;
  }

  return false;
}

/**
 * Compares the model's claimed answer against our own computation.
 *
 * `checked` means the two agree and the answer may be shown with a badge.
 * `unverified` means they disagree and the UI must suppress the answer.
 * `not-applicable` means there was no computable arithmetic, so there is
 * nothing to agree or disagree about and the answer is shown unbadged.
 */
export function verifyAnswer(printedText: string, claimedAnswer: string | null): Verification {
  const computedText = computeAnswer(printedText);
  if (computedText === null) return NOT_APPLICABLE;

  if (!claimedAnswer || !claimedAnswer.trim()) {
    return {
      status: "unverified",
      computedAnswer: computedText,
      detail: "The model returned no answer to compare against.",
    };
  }

  const computedTokens = numericTokens(computedText);
  const computed = computedTokens[0];
  if (!computed) return NOT_APPLICABLE;

  const claimed = numericTokens(claimedAnswer);
  if (claimed.length === 0) {
    return {
      status: "unverified",
      computedAnswer: computedText,
      detail: "No number could be read out of the model's answer.",
    };
  }

  // The final number in a sentence is usually the answer. Accept a match
  // anywhere in the string too, since "11/12, which is just under 1" is a
  // correct answer whose last number is 1.
  const last = claimed[claimed.length - 1];
  if (last && sameValue(computed, last, claimedAnswer)) {
    return { status: "checked", computedAnswer: computedText, detail: "Model and in-process arithmetic agree." };
  }

  if (claimed.some((c) => sameValue(computed, c, claimedAnswer))) {
    return { status: "checked", computedAnswer: computedText, detail: "Computed value appears in the model's answer." };
  }

  return {
    status: "unverified",
    computedAnswer: computedText,
    detail: `Model answer did not contain ${computedText}.`,
  };
}
