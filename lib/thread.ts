import type { MethodMatch, RegisterName, Script } from "@/lib/ai/schemas";
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
