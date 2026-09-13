import { copy } from "@/lib/copy";
import type { MoveLabelName } from "@/lib/ai/schemas";

/**
 * The Live Mode rule engine.
 *
 * Pure functions over an explicit state object, so the interruption policy
 * can be tested without a microphone, a model, or a database.
 *
 * The restraint here is the product. A parent mid-homework can absorb about
 * three interruptions before the app becomes another thing shouting at them,
 * so the caps are hard caps and the cooldown is long.
 */

export const LIVE_RULES = {
  /** Seconds of quiet after a card before another may appear. */
  cooldownSeconds: 90,
  /** Hard cap on coaching cards in one session. */
  maxCardsPerSession: 3,
  /** Default confidence a label needs before it earns a card. */
  confidenceThreshold: 0.7,
  /** Threshold for parents who said math at school was hard (bands 3 and 4). */
  anxiousConfidenceThreshold: 0.55,
  /** One problem for longer than this is a Park It. */
  parkAfterSeconds: 20 * 60,
  /** Two escalations inside this window is a Park It. */
  escalationWindowSeconds: 3 * 60,
  escalationCountToPark: 2,
} as const;

/** Labels that earn a card, and what the card says.
 *
 *  `GIVES_ANSWER` is deliberately absent. It is logged, because it feeds the
 *  autonomy ratio on the recap, but it never raises a card: telling a parent
 *  off mid-sentence for helping is the fastest way to have Live Mode turned
 *  off for good. It belongs in the recap, not in the moment. */
const CARD_TEXT: Partial<Record<MoveLabelName, string>> = {
  ANXIETY_STATEMENT: copy.cards.ANXIETY_STATEMENT,
  GENERIC_PRAISE: copy.cards.GENERIC_PRAISE,
  TAKES_OVER: copy.cards.TAKES_OVER,
  ESCALATION: copy.cards.ESCALATION,
  PRODUCTIVE_WAIT: copy.cards.PRODUCTIVE_WAIT,
};

export interface LiveState {
  cardsShown: number;
  /** tOffset of the last card, or null if none yet. */
  lastCardAt: number | null;
  /** tOffsets of ESCALATION labels seen so far. */
  escalationsAt: number[];
  parked: boolean;
}

export function initialLiveState(): LiveState {
  return { cardsShown: 0, lastCardAt: null, escalationsAt: [], parked: false };
}

export interface RuleInput {
  label: MoveLabelName;
  confidence: number;
  /** Seconds since the session started. */
  tOffset: number;
  /** 1 loved it .. 4 genuinely miserable. */
  anxietyBand: number;
  state: LiveState;
}

export interface ParkVerdict {
  reason: "time" | "escalation";
}

export interface RuleOutcome {
  /** The coaching card to surface, or null. */
  card: { triggerLabel: MoveLabelName; text: string; tOffset: number } | null;
  /** Set when the session should stop. */
  park: ParkVerdict | null;
  state: LiveState;
}

function thresholdFor(anxietyBand: number): number {
  // A parent who found math miserable at school is the one this helps most,
  // and is also the one least likely to notice their own anxiety statements.
  // Lower the bar so the coaching actually arrives.
  return anxietyBand >= 3 ? LIVE_RULES.anxiousConfidenceThreshold : LIVE_RULES.confidenceThreshold;
}

/**
 * Decides what, if anything, happens in response to one classified move.
 *
 * Park It is evaluated first and is not subject to the card cap or the
 * cooldown: it is a safety stop, not coaching.
 */
export function evaluateMove(input: RuleInput): RuleOutcome {
  const { label, confidence, tOffset, anxietyBand } = input;
  const state: LiveState = {
    ...input.state,
    escalationsAt: [...input.state.escalationsAt],
  };

  if (state.parked) return { card: null, park: null, state };

  if (label === "ESCALATION" && confidence >= thresholdFor(anxietyBand)) {
    state.escalationsAt.push(tOffset);
  }

  const recentEscalations = state.escalationsAt.filter(
    (t) => tOffset - t <= LIVE_RULES.escalationWindowSeconds,
  );

  if (recentEscalations.length >= LIVE_RULES.escalationCountToPark) {
    state.parked = true;
    return { card: null, park: { reason: "escalation" }, state };
  }

  if (tOffset >= LIVE_RULES.parkAfterSeconds) {
    state.parked = true;
    return { card: null, park: { reason: "time" }, state };
  }

  const text = CARD_TEXT[label];
  if (!text) return { card: null, park: null, state };
  if (confidence < thresholdFor(anxietyBand)) return { card: null, park: null, state };
  if (state.cardsShown >= LIVE_RULES.maxCardsPerSession) return { card: null, park: null, state };
  if (state.lastCardAt !== null && tOffset - state.lastCardAt < LIVE_RULES.cooldownSeconds) {
    return { card: null, park: null, state };
  }

  state.cardsShown += 1;
  state.lastCardAt = tOffset;

  return { card: { triggerLabel: label, text, tOffset }, park: null, state };
}

/** True when a label should be persisted as a Move row. All of them are. */
export function shouldLogMove(label: MoveLabelName): boolean {
  return label !== "NEUTRAL";
}
