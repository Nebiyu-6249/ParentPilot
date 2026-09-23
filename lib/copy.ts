/**
 * Every user-facing string in ParentPilot passes through this module.
 *
 * Two jobs:
 *   1. Keep tone consistent by keeping the strings in one file.
 *   2. Enforce the em-dash ban in one place. The ban applies to model
 *      output as well as to hard-coded UI copy, so `sanitize` is called on
 *      everything the model writes before it reaches a component. The
 *      prompt files also carry the rule, but a prompt is a request and this
 *      is a guarantee.
 */

import { en } from "@/lib/i18n/messages/en";

const EM_DASH = /—|―/g; // em dash, horizontal bar
const SPACED_EN_DASH = /\s–\s/g; // en dash used as an em dash

/**
 * Removes em dashes from a string without mangling the sentence.
 *
 * `a — b` and `a—b` both become `a, b`. A trailing dash becomes a full
 * stop. Numeric ranges written with an unspaced en dash (`3-6`) are left
 * alone, since the ban is on the rhetorical dash, not on ranges.
 */
export function sanitize(input: string): string {
  return input
    .replace(SPACED_EN_DASH, ", ")
    .replace(/\s*(?:—|―)\s*$/g, ".")
    .replace(/\s*(?:—|―)\s*/g, ", ")
    .replace(EM_DASH, ", ")
    .replace(/ {2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/** Recursively sanitizes every string in a parsed model response. */
export function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") return sanitize(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }
  return value;
}

/** Tagged template that sanitizes interpolated copy at the call site. */
export function t(strings: TemplateStringsArray, ...values: unknown[]): string {
  return sanitize(strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i]) : ""), ""));
}


/**
 * The English catalogue, under its historical name.
 *
 * Kept because three kinds of caller want English specifically and should not
 * have to pass a locale to say so: `app/layout.tsx` builds metadata at module
 * scope where there is no request to read a profile from, the marketing pages
 * are English by decision, and the check suites assert against known strings.
 *
 * Anything rendering to a parent inside the product reads `messages(locale)`
 * instead. See lib/i18n/index.ts.
 */
export const copy = en;


export type Copy = typeof copy;

/**
 * How a year group reads on screen.
 *
 * Four screens show one and all four go through here, because the interesting
 * case is the one they each used to get wrong: `grade` is nullable now, and
 * `Grade ${null}` renders the word "null" to a parent.
 */
export function gradeLabel(grade: number | null): string {
  if (grade === null) return copy.common.gradeUnknown;
  return grade === 0 ? copy.common.kindergarten : `Grade ${grade}`;
}
