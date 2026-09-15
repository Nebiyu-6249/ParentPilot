import type { ChatIntent, MethodMatch, RegisterName, Script } from "@/lib/ai/schemas";
import type { PacketBundle } from "@/lib/types";

/**
 * The turn model.
 *
 * An assistant turn is a list of cards rather than a block of prose. These
 * shapes are what the server sends and what the thread renders, so a card kind
 * that has no payload shape here cannot be emitted by accident.
 */

export type CardKind =
  | "notice"
  | "worksheet"
  | "ask"
  | "misconception"
  | "method_match"
  | "answer"
  | "teaching"
  | "live_summary"
  | "live_coach"
  | "park_it"
  | "text";

/**
 * Says out loud that a packet did not come from a reading of this page.
 *
 * Round three made degradation visible and this surface has to keep that
 * promise: a saved example that renders identically to a real reading is the
 * one failure mode that actually costs a parent something, because they act
 * on it believing we read their child's working.
 */
export interface NoticeCard {
  kind: "notice";
  body: string;
}

export interface WorksheetCard {
  kind: "worksheet";
  problemId: string;
  printedText: string;
  childWorkText: string | null;
  childAnswer: string | null;
  imageDataUrl: string | null;
  verification: PacketBundle["verification"];
  standardCode: string | null;
  standardPlain: string | null;
  grade: number | null;
}

export interface AskCard {
  kind: "ask";
  problemId: string;
  question: string;
  rung: number;
  total: number;
}

export interface MisconceptionCard {
  kind: "misconception";
  plainName: string;
  note: string | null;
  repairQuestion: string;
  visualSvg: string | null;
}

export interface MethodMatchCard {
  kind: "method_match";
  data: MethodMatch;
}

export interface AnswerCard {
  kind: "answer";
  answer: string;
  verification: PacketBundle["verification"];
}

export interface TeachingCard {
  kind: "teaching";
  opening: string;
  rest: string;
  scripts: Script[];
  problemId: string;
  register: RegisterName;
}

/**
 * A coaching interruption raised while Live Mode is listening.
 *
 * It is a turn in the thread rather than an overlay, which is the whole of
 * folding Live Mode in: what the product said at 8:14pm sits above what it
 * said at 8:15pm, and a parent who missed one can scroll back to it. The
 * overlay it replaces was dismissable and then gone.
 *
 * Carries the label that triggered it and the second it fired, which is
 * exactly what the `Move` table stores. There is no text of what was said
 * here, because there is nowhere in the product that holds that.
 */
export interface LiveCoachCard {
  kind: "live_coach";
  triggerLabel: string;
  body: string;
  tOffset: number;
}

export interface LiveSummaryCard {
  kind: "live_summary";
  autonomyScore: number;
  reading: string;
  moveCounts: Record<string, number>;
  minutes: number;
}

export interface ParkItCard {
  kind: "park_it";
  reason: "time" | "escalation";
  teacherNote: string | null;
}

export interface TextCard {
  kind: "text";
  body: string;
  /**
   * Why this reply exists, on the turns a model wrote.
   *
   * Absent on the ones this product writes itself. It is real information
   * rather than a test hook: a redirect and a piece of coaching are different
   * kinds of reply, and the thread renders the distinction so that "what does
   * this product refuse to do" is answerable from the outside.
   */
  intent?: ChatIntent;
}

export type Card =
  | NoticeCard
  | WorksheetCard
  | AskCard
  | MisconceptionCard
  | MethodMatchCard
  | AnswerCard
  | TeachingCard
  | LiveSummaryCard
  | LiveCoachCard
  | ParkItCard
  | TextCard;

export interface Turn {
  id: string;
  role: "PARENT" | "ASSISTANT";
  /** Parent turns carry text; assistant turns carry cards. */
  body: string | null;
  cards: Card[];
  createdAt: string;
}

/** Splits a primer into its opening two sentences and the rest. */
export function splitPrimer(primer: string): { opening: string; rest: string } {
  const sentences = primer.split(/(?<=\.)\s+/);
  return {
    opening: sentences.slice(0, 2).join(" "),
    rest: sentences.slice(2).join(" "),
  };
}

/**
 * Turns a generated packet into the cards a thread shows for a new problem.
 *
 * Order matters: the worksheet establishes what we read, then the question,
 * then everything else collapsed. `ask` is the only card that opens by
 * default, because it is the only one a parent needs in the moment.
 */
export function cardsForPacket(
  bundle: PacketBundle,
  imageDataUrl: string | null,
  rung = 0,
): Card[] {
  const { problem, standard, misconception, packet } = bundle;
  const primer = splitPrimer(packet.primer);

  const cards: Card[] = [];

  // First, before the worksheet, because it changes how everything under it
  // should be read.
  if (bundle.notice) cards.push({ kind: "notice", body: bundle.notice });

  cards.push(
    {
      kind: "worksheet",
      problemId: problem.id,
      printedText: problem.printedText,
      childWorkText: problem.childWorkText,
      childAnswer: problem.childAnswer,
      imageDataUrl,
      verification: bundle.verification,
      standardCode: standard?.code ?? null,
      standardPlain: standard?.plainLanguage ?? null,
      grade: standard?.grade ?? null,
    },
    {
      kind: "ask",
      problemId: problem.id,
      question: packet.hintLadder[rung] ?? packet.hintLadder[0] ?? "",
      rung,
      total: packet.hintLadder.length,
    },
  );

  if (misconception) {
    cards.push({
      kind: "misconception",
      plainName: misconception.plainName,
      note: packet.misconceptionNote,
      repairQuestion: misconception.repairQuestion,
      visualSvg: misconception.visualSvg,
    });
  }

  cards.push(
    { kind: "method_match", data: packet.methodMatch },
    {
      kind: "teaching",
      opening: primer.opening,
      rest: primer.rest,
      scripts: packet.scripts,
      problemId: problem.id,
      register: packet.register,
    },
    { kind: "answer", answer: packet.lockedAnswer, verification: bundle.verification },
  );

  return cards;
}

/**
 * What this thread is about.
 *
 * The printed problem, once one has been read. Empty until then rather than a
 * placeholder, because an empty bar is honest and "New worksheet" in the rail
 * and the bar at once is not information.
 *
 * It lives here rather than in the shell because a thread holds more than one
 * problem once free text lands, and the question of what to call a thread that
 * has worked three problems should have one home when it arrives.
 */
export function threadTitle(turns: Turn[]): string {
  for (const turn of turns) {
    for (const card of turn.cards) {
      if (card.kind === "worksheet") return card.printedText;
    }
  }
  return "";
}

/**
 * The problem the thread is on right now, which is the most recent one read.
 *
 * Deliberately the newest rather than the first: a parent who has photographed
 * a second page is working the second page, and the note they send a teacher
 * is about where they actually stopped.
 */
export interface CurrentProblem {
  problemId: string;
  printedText: string;
  standardPlain: string | null;
  misconceptionName: string | null;
}

export function currentProblem(turns: Turn[]): CurrentProblem | null {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (!turn) continue;

    const worksheet = turn.cards.find((card): card is WorksheetCard => card.kind === "worksheet");
    if (!worksheet) continue;

    const misconception = turn.cards.find(
      (card): card is MisconceptionCard => card.kind === "misconception",
    );

    return {
      problemId: worksheet.problemId,
      printedText: worksheet.printedText,
      standardPlain: worksheet.standardPlain,
      misconceptionName: misconception?.plainName ?? null,
    };
  }
  return null;
}

/** The rung currently showing for a problem, so "Still stuck" knows where it is. */
export function lastRung(turns: Turn[], problemId: string): number {
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (!turn) continue;
    for (let j = turn.cards.length - 1; j >= 0; j -= 1) {
      const card = turn.cards[j];
      if (card && card.kind === "ask" && card.problemId === problemId) return card.rung;
    }
  }
  return 0;
}

/**
 * One line of the conversation, as the model is shown it.
 *
 * Built on the client from the cards already rendered, then validated and
 * rendered to a string on the server. Deliberately a narrow shape: the client
 * supplies what was said, and the server supplies every fact about the problem
 * from its own database, so a tampered request cannot change what the model is
 * told about a child's working.
 */
export interface ThreadLine {
  role: "PARENT" | "ASSISTANT";
  text: string;
}

/** How many lines of history the model is shown. */
export const TRANSCRIPT_LINES = 12;

/**
 * The conversation so far, for a free-text turn.
 *
 * The `answer` card is excluded by construction, and that is the important
 * line in this function. Feeding a rendered thread back to a model would put
 * the locked answer in its context on the second turn, and a parent who then
 * asked "so what is it" would be told, which is the one thing the product
 * exists to prevent.
 */
export function threadTranscript(turns: Turn[], limit = TRANSCRIPT_LINES): ThreadLine[] {
  const lines: ThreadLine[] = [];

  for (const turn of turns) {
    if (turn.role === "PARENT") {
      if (turn.body) lines.push({ role: "PARENT", text: turn.body });
      continue;
    }

    for (const card of turn.cards) {
      switch (card.kind) {
        case "worksheet":
          lines.push({ role: "ASSISTANT", text: `Read a page: ${card.printedText}` });
          break;
        case "ask":
          lines.push({ role: "ASSISTANT", text: `Gave the question: ${card.question}` });
          break;
        case "misconception":
          lines.push({ role: "ASSISTANT", text: `Named the misconception: ${card.plainName}` });
          break;
        case "text":
          lines.push({ role: "ASSISTANT", text: card.body });
          break;
        case "live_coach":
          lines.push({ role: "ASSISTANT", text: `Raised a coaching card: ${card.triggerLabel}` });
          break;
        // "answer" is never included. "notice" and the rest are about this
        // deployment or about layout, and say nothing about the child.
        default:
          break;
      }
    }
  }

  return lines.slice(-limit);
}

/**
 * Whether a reply gives the answer away.
 *
 * The prompt forbids it and this decides it, for the same reason the em-dash
 * ban lives in `sanitize` as well as in every prompt file: a prompt is a
 * request and this is a guarantee. The caller replaces the reply rather than
 * editing it, because a sentence with the answer cut out of it is a sentence
 * that no longer means anything.
 *
 * Matches on the computed value rather than the whole `lockedAnswer`, which is
 * a sentence and would never appear verbatim. The boundaries are hand rolled
 * because `\b` does not fire either side of a slash, so `11/12` inside
 * `111/12` would otherwise count as a match.
 *
 * The trailing boundary has to let a full stop through while still rejecting a
 * decimal point. "It is 11/12." is the commonest way a reply would give the
 * answer away, and an earlier version of this missed exactly that sentence.
 */
export function revealsAnswer(reply: string, computedAnswer: string | null): boolean {
  const needle = computedAnswer?.trim();
  if (!needle) return false;

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w/.])${escaped}(?![\\w/]|\\.\\d)`).test(reply);
}

/**
 * The last word on whether the press and hold is offered.
 *
 * The prompt tells the classifier when `answer` may fire. This decides it, for
 * the same reason `sanitize` exists next to the em-dash rule in every prompt
 * file: a prompt is a request and this is a guarantee.
 *
 * Every case below is a line from the transcript this was written to fix. A
 * parent typing "what is a denominator" was shown "Here it is, behind the
 * hold", which tells them a reasonable question is off limits. That is the
 * worst failure the product has, and it is cheap to make impossible.
 */
/* "what is a denominator" is a definition. "what is the answer" is not, and
   an earlier version of this caught both, which would have broken the one
   case the press and hold exists for. The nouns below name the thing being
   worked out rather than a term to define. */
const ANSWER_NOUN = /^(?:answer|solution|result|total|sum|value)\b/i;
const DEFINITION = /^\s*(?:so\s+|and\s+|but\s+|ok(?:ay)?,?\s+)?what(?:'|’)?s?\s+(?:is|are)?\s*(?:a|an|the)\s+(\w.*)$/i;
const MEANING = /\b(?:what does .+ mean|meaning of|definition of|define)\b/i;
const EXAMPLE = /\b(?:example|show me|demonstrate|walk me through|work(?:ed)? (?:it |one )?out)\b/i;
const CLARIFICATION = /^\s*(?:what|huh|sorry|eh|pardon|come again|i don(?:'|’)?t (?:get|follow|understand) (?:it|that|you))\s*[?!.]*\s*$/i;

export function resolveIntent(
  said: string,
  proposed: ChatIntent,
  hasActiveProblem: boolean,
): ChatIntent {
  if (proposed !== "answer") return proposed;

  // No problem in front of the child means no answer to hold back, so a
  // classifier that reached for one has misread the question.
  if (!hasActiveProblem) return "explain";

  if (CLARIFICATION.test(said)) return "clarify";
  if (EXAMPLE.test(said)) return "example";

  const defined = said.match(DEFINITION)?.[1];
  if ((defined !== undefined && !ANSWER_NOUN.test(defined)) || MEANING.test(said)) {
    return "explain";
  }

  return "answer";
}
