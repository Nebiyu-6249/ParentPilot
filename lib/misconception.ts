import { prisma, hasDatabase } from "@/lib/db";
import { judgeMisconception } from "@/lib/ai/provider";
import type { MisconceptionView } from "@/lib/types";

/**
 * Misconception matching: signature heuristics first, model judge second.
 *
 * A handful of misconceptions leave an arithmetic fingerprint precise enough
 * to detect in code, and those are detected in code, because a deterministic
 * match is worth far more than a probable one when the output is a sentence
 * telling a parent what their child believes. Everything else goes to a
 * shortlist and a single judge call, which is allowed to return nothing.
 *
 * Nothing here manufactures a match to fill the field. A wrong misconception
 * is worse than none: it sends the parent to repair a belief the child does
 * not hold.
 */

const JUDGE_THRESHOLD = 0.6;

interface Frac {
  n: number;
  d: number;
}

function parseFractionPair(text: string): { a: Frac; b: Frac; op: "+" | "-" } | null {
  const match = text.match(/(\d+)\s*\/\s*(\d+)\s*([+\-])\s*(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  const [, an, ad, op, bn, bd] = match;
  if (!an || !ad || !bn || !bd || !op) return null;
  return {
    a: { n: Number(an), d: Number(ad) },
    b: { n: Number(bn), d: Number(bd) },
    op: op === "-" ? "-" : "+",
  };
}

function parseSingleFraction(text: string): Frac | null {
  const match = text.match(/(-?\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  const [, n, d] = match;
  if (!n || !d) return null;
  return { n: Number(n), d: Number(d) };
}

/**
 * Adding numerators and denominators, so 1/4 + 2/3 is written as 3/7.
 *
 * The fingerprint is exact: the child's answer is componentwise, and it is
 * not also the correct answer (2/4 + 1/4 would be a false positive).
 */
function detectWholeNumberBias(printed: string, work: string): string | null {
  const pair = parseFractionPair(printed);
  if (!pair) return null;
  const { a, b, op } = pair;

  const componentwise: Frac = { n: op === "+" ? a.n + b.n : a.n - b.n, d: a.d + b.d };
  const correct: Frac = {
    n: op === "+" ? a.n * b.d + b.n * a.d : a.n * b.d - b.n * a.d,
    d: a.d * b.d,
  };

  // If componentwise happens to be correct, the working proves nothing.
  if (componentwise.n * correct.d === correct.n * componentwise.d) return null;

  const written = parseWrittenAnswers(work);
  const hit = written.some((f) => f.n === componentwise.n && f.d === componentwise.d);
  return hit ? "whole-number-bias-fraction-addition" : null;
}

/** Every fraction the child wrote, in order. */
function parseWrittenAnswers(work: string): Frac[] {
  const out: Frac[] = [];
  for (const m of work.matchAll(/(-?\d+)\s*\/\s*(\d+)/g)) {
    const [, n, d] = m;
    if (n && d) out.push({ n: Number(n), d: Number(d) });
  }
  return out;
}

/**
 * The smaller-from-larger bug: each column is subtracted smaller from
 * larger regardless of position, so 43 minus 27 gives 24.
 */
function detectSmallerFromLarger(printed: string, work: string): string | null {
  const match = printed.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const [, topText, bottomText] = match;
  if (!topText || !bottomText) return null;

  const top = Number(topText);
  const bottom = Number(bottomText);
  if (top < bottom) return null;

  const correct = top - bottom;
  const buggy = columnwiseAbsoluteDifference(topText, bottomText);
  if (buggy === null || buggy === correct) return null;

  const numbers = [...work.matchAll(/-?\d+/g)].map((m) => Number(m[0]));
  return numbers.includes(buggy) ? "smaller-from-larger-subtraction" : null;
}

function columnwiseAbsoluteDifference(top: string, bottom: string): number | null {
  const width = Math.max(top.length, bottom.length);
  const t = top.padStart(width, "0");
  const b = bottom.padStart(width, "0");
  let digits = "";
  for (let i = 0; i < width; i += 1) {
    const td = Number(t[i]);
    const bd = Number(b[i]);
    if (Number.isNaN(td) || Number.isNaN(bd)) return null;
    digits += String(Math.abs(td - bd));
  }
  return Number(digits);
}

/**
 * Strict left-to-right evaluation, so 2 + 3 x 4 gives 20.
 *
 * Only fires when left-to-right and correct precedence actually differ.
 */
function detectLeftToRight(printed: string, work: string): string | null {
  const expression = printed.split("=")[0] ?? printed;
  const normalised = expression
    .replace(/[×⋅•]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    // `x` between two numbers is a multiplication cross, not a variable.
    .replace(/(\d)\s*[xX]\s*(?=\d)/g, "$1 * ");
  const tokens = normalised.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.length < 5) return null;
  if (!tokens.some((tk) => tk === "*" || tk === "/")) return null;
  if (/[()]/.test(normalised)) return null;

  const first = tokens[0];
  if (first === undefined) return null;

  let running = Number(first);
  if (Number.isNaN(running)) return null;

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const operandText = tokens[i + 1];
    if (op === undefined || operandText === undefined) return null;
    const operand = Number(operandText);
    if (Number.isNaN(operand)) return null;
    if (op === "+") running += operand;
    else if (op === "-") running -= operand;
    else if (op === "*") running *= operand;
    else if (op === "/") running /= operand;
    else return null;
  }

  const correct = evaluateWithPrecedence(tokens);
  if (correct === null || correct === running) return null;

  const numbers = [...work.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  return numbers.includes(running) ? "left-to-right-order-of-operations" : null;
}

function evaluateWithPrecedence(tokens: string[]): number | null {
  const values: number[] = [];
  const ops: string[] = [];

  const firstToken = tokens[0];
  if (firstToken === undefined) return null;
  values.push(Number(firstToken));

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const operandText = tokens[i + 1];
    if (op === undefined || operandText === undefined) return null;
    const operand = Number(operandText);

    if (op === "*" || op === "/") {
      const left = values.pop();
      if (left === undefined) return null;
      values.push(op === "*" ? left * operand : left / operand);
    } else {
      ops.push(op);
      values.push(operand);
    }
  }

  const firstValue = values[0];
  if (firstValue === undefined) return null;

  let total = firstValue;
  for (let i = 0; i < ops.length; i += 1) {
    const value = values[i + 1];
    if (value === undefined) return null;
    total = ops[i] === "-" ? total - value : total + value;
  }
  return total;
}

/** Code detectors, in order. The first exact fingerprint wins. */
const DETECTORS: ((printed: string, work: string) => string | null)[] = [
  detectWholeNumberBias,
  detectSmallerFromLarger,
  detectLeftToRight,
];

export interface MatchArgs {
  printedText: string;
  childWorkText: string | null;
  childAnswer: string | null;
  standardCode: string | null;
}

/**
 * Returns the id of the misconception the working matches, or null.
 *
 * Null is the common and correct answer. It is returned whenever there is no
 * working to read, whenever the working is simply correct, and whenever
 * nothing on the fixed list genuinely fits.
 */
export async function matchMisconception(args: MatchArgs): Promise<string | null> {
  const work = [args.childWorkText, args.childAnswer].filter(Boolean).join("\n").trim();
  if (!work) return null;

  for (const detect of DETECTORS) {
    const hit = detect(args.printedText, work);
    if (hit) return hit;
  }

  if (!hasDatabase()) return null;

  // Shortlist: same standard first, then the same topic, capped so the judge
  // sees a real choice rather than the whole table.
  let candidates: { id: string; plainName: string; signature: string }[] = [];
  try {
    const scoped = args.standardCode
      ? await prisma.misconception.findMany({ where: { standardCode: args.standardCode } })
      : [];
    const rest = await prisma.misconception.findMany({
      where: args.standardCode ? { standardCode: { not: args.standardCode } } : {},
      take: 12,
    });
    candidates = [...scoped, ...rest]
      .slice(0, 12)
      .map((m) => ({ id: m.id, plainName: m.plainName, signature: m.signature }));
  } catch (error) {
    console.error("[misconception] shortlist failed", error);
    return null;
  }

  if (candidates.length === 0) return null;

  try {
    const judgement = await judgeMisconception({
      printedText: args.printedText,
      childWorkText: work,
      childAnswer: args.childAnswer,
      candidates,
    });

    if (!judgement.misconceptionId) return null;
    if (judgement.confidence < JUDGE_THRESHOLD) return null;
    // The judge is only allowed to pick from the shortlist it was shown.
    if (!candidates.some((c) => c.id === judgement.misconceptionId)) return null;

    return judgement.misconceptionId;
  } catch (error) {
    console.error("[misconception] judge call failed", error);
    return null;
  }
}

/** Loads one misconception for rendering. */
export async function misconceptionById(id: string | null): Promise<MisconceptionView | null> {
  if (!id || !hasDatabase()) return null;
  try {
    const row = await prisma.misconception.findUnique({ where: { id } });
    return row
      ? {
          id: row.id,
          topic: row.topic,
          plainName: row.plainName,
          repairQuestion: row.repairQuestion,
          visualSvg: row.visualSvg,
        }
      : null;
  } catch {
    return null;
  }
}

export const detectors = { detectWholeNumberBias, detectSmallerFromLarger, detectLeftToRight };
