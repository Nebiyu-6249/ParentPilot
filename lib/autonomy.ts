import type { MoveLabelName } from "@/lib/ai/schemas";

/**
 * Autonomy-support ratio.
 *
 * Supportive moves over directive moves, with a 1 in the denominator so a
 * session with no directive moves at all still produces a finite number
 * rather than dividing by zero.
 *
 * The number is deliberately not a percentage and not a grade. It is a
 * ratio, shown with the counts that produced it, so a parent can see what it
 * is made of rather than being handed a score.
 */

export const SUPPORTIVE: MoveLabelName[] = ["PROBING_QUESTION", "SPECIFIC_PRAISE", "PRODUCTIVE_WAIT"];
export const DIRECTIVE: MoveLabelName[] = ["GIVES_ANSWER", "GENERIC_PRAISE", "CRITICISM", "TAKES_OVER"];

export type MoveCounts = Partial<Record<MoveLabelName, number>>;

export function countMoves(labels: MoveLabelName[]): MoveCounts {
  const counts: MoveCounts = {};
  for (const label of labels) counts[label] = (counts[label] ?? 0) + 1;
  return counts;
}

export function autonomyScore(counts: MoveCounts): number {
  const sum = (labels: MoveLabelName[]): number =>
    labels.reduce((total, label) => total + (counts[label] ?? 0), 0);

  return sum(SUPPORTIVE) / (sum(DIRECTIVE) + 1);
}

/** A plain-language reading of the ratio. Never a grade, never a comparison. */
export function autonomyReading(score: number): string {
  if (score >= 2) return "Your child did most of the thinking.";
  if (score >= 1) return "The thinking was shared fairly evenly.";
  if (score > 0) return "You carried more of the thinking than your child did.";
  return "Nothing supportive was classified in this session.";
}
