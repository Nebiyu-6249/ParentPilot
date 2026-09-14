import { copy } from "@/lib/copy";
import type { ChatTurn, MethodMatch, MoveLabelName, RegisterName, Script } from "@/lib/ai/schemas";
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
  | "coach"
  | "worksheet"
  | "ask"
  | "misconception"
  | "method_match"
  | "answer"
  | "teaching"
  | "live_card"
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

/**
 * The reply to something the parent typed.
 *
 * The one card that carries prose, because a reply to a sentence is a
 * sentence. `sayThis` gets the same treatment as the `ask` card's question:
 * both are words to say out loud, and one idea should look like one idea
 * wherever it turns up.
 */
export interface CoachCard {
  kind: "coach";
  reply: string;
  sayThis: string | null;
  watchFor: string | null;
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
 * A nudge that arrived while Live Mode was listening.
 *
 * Carries the coaching line and the moment it was earned, and nothing else.
 * There is deliberately no field here that could hold a word anybody said:
 * the rolling window lives in a ref inside `useLiveTranscript` and is the one
 * thing in this product that never becomes a card, a message or a row.
 */
export interface LiveCardCard {
  kind: "live_card";
  text: string;
  triggerLabel: MoveLabelName;
  /** Seconds into the session. */
  tOffset: number;
}

export interface LiveSummaryCard {
  kind: "live_summary";
  autonomyScore: number;
  reading: string;
  moveCounts: Record<string, number>;
  minutes: number;
  /** Written from move counts alone, by a model that never saw the words. */
  recap: string | null;
  oneThingToTry: string | null;
  /** Null when there was no database to record the session in. */
  sessionId: string | null;
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
  | CoachCard
  | WorksheetCard
  | AskCard
  | MisconceptionCard
  | MethodMatchCard
  | AnswerCard
  | TeachingCard
  | LiveCardCard
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
 * The cards for a free-text turn.
 *
 * Two of the three intents never reach the model's own prose. "Just tell me
 * the answer" and an off-topic question are both answered by fixed copy, so
 * those replies are the same sentence every time and cannot be argued out of
 * the product by a parent who phrases the request more cleverly. `leaked` is
 * the answer guard firing on a `coach` reply, and it lands in the same place:
 * from where the parent sits, being told the answer is behind the hold is the
 * same event whether they asked for it or the model volunteered it.
 *
 * `rungQuestion` is what turns the refusal into a move. Declining to give the
 * answer and offering nothing in its place is just a wall.
 */
export function cardsForChatTurn(
  turn: ChatTurn,
  options: { rungQuestion: string | null; leaked: boolean },
): Card[] {
  /* Asking for an answer with no worksheet open is asking to be a
     calculator, which is the out-of-scope case rather than the withheld one:
     there is no answer card to point at, and pointing at one would be a lie.
     A leak cannot reach here, because with no problem there is no verified
     answer for the guard to have matched. */
  const noWorksheet = options.rungQuestion === null;
  if (turn.intent === "out_of_scope" || (turn.intent === "answer_request" && noWorksheet)) {
    return [{ kind: "coach", reply: copy.chat.outOfScope, sayThis: null, watchFor: null }];
  }

  if (turn.intent === "answer_request" || options.leaked) {
    return [
      {
        kind: "coach",
        reply: options.rungQuestion
          ? `${copy.chat.answerHeld} ${copy.chat.answerHeldNext}`
          : copy.chat.answerHeld,
        sayThis: options.rungQuestion,
        watchFor: null,
      },
    ];
  }

  return [{ kind: "coach", reply: turn.reply, sayThis: turn.sayThis, watchFor: turn.watchFor }];
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
