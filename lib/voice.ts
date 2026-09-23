import { revealsAnswer } from "@/lib/thread";

/**
 * What may be said out loud while a child is in the room.
 *
 * Every other guarantee in this product is about a screen. A parent reads the
 * screen; the child does not. Speech breaks that arrangement: the reply is in
 * the air, and the nine year old sitting at the same table hears all of it.
 *
 * So the spoken rendering of a turn is a different artefact from the written
 * one, and this is the gate it passes before anything is synthesised. It is
 * deterministic and it runs on the server, for the same reason `revealsAnswer`
 * does: the prompt asks, and this decides.
 *
 * **What it can and cannot catch.** Three things are checkable exactly, and
 * they are the three worst outcomes:
 *
 *   1. The computed answer, spoken aloud. This ends the learning and it ends
 *      it for the child as well as the parent, who at least chose to press and
 *      hold.
 *   2. The misconception, named. "She thinks a fraction is two numbers" is a
 *      sentence about a child, said in front of that child.
 *   3. The child's own name. Almost every sentence that would embarrass a
 *      nine year old has their name in it, and a spoken coaching line does
 *      not need one: the parent knows who they are talking to.
 *
 * Everything past that, tone and implication, is the prompt's job and the
 * eval's job to measure. This does not pretend to judge it. A check that
 * claimed to and could not would be worse than one that states its limits.
 */

export interface OverheardArgs {
  /** The spoken rendering, as it would be synthesised. */
  spoken: string;
  /** The verified answer to the active problem, or null when there is none. */
  computedAnswer: string | null;
  /** The misconception's parent-facing name, or null. */
  misconceptionName: string | null;
  /** The child's first name, when the parent gave one. */
  childName: string | null;
  /**
   * The "she can hear this" toggle, default on.
   *
   * Off does not unlock the answer. A parent who has stepped into the hall is
   * still a parent this product does not read answers to, and the press and
   * hold is the only route to one. What it relaxes is the name and the
   * misconception, which are only unsafe because of who is listening.
   */
  childCanHear: boolean;
}

export type OverheardReason = "answer" | "misconception" | "child-name" | "verdict";

export interface OverheardVerdict {
  ok: boolean;
  reasons: OverheardReason[];
}

/** Word-ish boundary that survives punctuation and an apostrophe. */
function mentions(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (trimmed.length < 2) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(haystack);
}

/**
 * The distinctive words of a misconception's name.
 *
 * Matching the whole name verbatim would catch almost nothing: a model asked
 * not to label a child does not usually quote a label, it paraphrases one. So
 * this takes the content words and fails when most of them turn up in one
 * spoken reply, which is what a paraphrase looks like.
 *
 * Deliberately not a stemmer or a synonym list. Those would make this feel
 * cleverer and would move the failure from "missed a paraphrase" to "refused a
 * sentence that was fine", and a voice mode that silently refuses is a voice
 * mode nobody uses.
 */
const COMMON = new Set([
  "a", "an", "the", "and", "or", "of", "as", "to", "in", "on", "at", "is", "are", "was", "were",
  "it", "its", "that", "this", "with", "when", "for", "from", "by", "two", "she", "he", "they",
]);

function contentWords(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !COMMON.has(w));
}

/** How much of a misconception's vocabulary counts as having named it. */
const MISCONCEPTION_OVERLAP = 0.6;

export function overheardSafety(args: OverheardArgs): OverheardVerdict {
  const reasons: OverheardReason[] = [];
  const spoken = args.spoken;

  // 1. The answer. Checked whoever is listening, because the press and hold is
  //    the only route to it and speech is not a press and hold.
  if (revealsAnswer(spoken, args.computedAnswer)) reasons.push("answer");

  if (args.childCanHear) {
    // 2. The misconception, named or paraphrased closely enough to be one.
    if (args.misconceptionName) {
      const words = contentWords(args.misconceptionName);
      if (words.length >= 3) {
        const hits = words.filter((w) => mentions(spoken, w)).length;
        if (hits / words.length >= MISCONCEPTION_OVERLAP) reasons.push("misconception");
      }
    }

    // 3. The child's name. A spoken coaching line does not need it.
    if (args.childName && mentions(spoken, args.childName)) reasons.push("child-name");
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Phrases a spoken reply must never carry, whatever the prompt returns.
 *
 * Narrow on purpose. These are the constructions that turn coaching into a
 * verdict delivered in front of the person it is about, and every one of them
 * is a phrase a model reaches for when it forgets who is in the room. English
 * only, and the check suite says so: the other locales are covered by the
 * three exact rules above and by the eval, and a half-built banned-phrase list
 * per language would read as coverage without being it.
 */
const VERDICTS = [
  /\bshe (?:got|has) (?:it|that|them) wrong\b/i,
  /\bhe (?:got|has) (?:it|that|them) wrong\b/i,
  /\bthat(?:'s| is) (?:not right|wrong|incorrect)\b/i,
  /\bshe do(?:es not|esn't) understand\b/i,
  /\bhe do(?:es not|esn't) understand\b/i,
  /\bthe mistake (?:she|he) made\b/i,
];

/** True when the reply delivers a verdict on the child rather than coaching. */
export function soundsLikeAVerdict(spoken: string): boolean {
  return VERDICTS.some((pattern) => pattern.test(spoken));
}

/**
 * The whole gate, as one call.
 *
 * Returns the text to synthesise, which is the model's rendering when it
 * passes and the fixed fallback when it does not. Never throws and never
 * returns something unchecked: a caller that forgets to look at `verdict`
 * still cannot synthesise an unsafe line.
 */
export function safeSpoken(
  args: OverheardArgs & { fallback: string },
): { text: string; verdict: OverheardVerdict; substituted: boolean } {
  const reasons = [...overheardSafety(args).reasons];
  if (args.childCanHear && soundsLikeAVerdict(args.spoken)) reasons.push("verdict");

  const failed = reasons.length > 0;
  return {
    text: failed ? args.fallback : args.spoken,
    verdict: { ok: !failed, reasons },
    substituted: failed,
  };
}
