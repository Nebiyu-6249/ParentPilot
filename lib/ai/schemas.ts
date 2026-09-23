import { z } from "zod";

/**
 * Shapes the model is contracted to return. Every model response is parsed
 * through one of these before it is allowed anywhere near a component, so a
 * malformed response fails loudly at the boundary rather than quietly
 * rendering `undefined` on a parent's screen.
 */

export const MOVE_LABELS = [
  "GIVES_ANSWER",
  "PROBING_QUESTION",
  "GENERIC_PRAISE",
  "SPECIFIC_PRAISE",
  "CRITICISM",
  "TAKES_OVER",
  "PRODUCTIVE_WAIT",
  "ANXIETY_STATEMENT",
  "ESCALATION",
  "NEUTRAL",
] as const;

export type MoveLabelName = (typeof MOVE_LABELS)[number];

export const REGISTERS = ["PLAIN", "STANDARD", "TECHNICAL"] as const;
export type RegisterName = (typeof REGISTERS)[number];

export const extractedProblemSchema = z.object({
  index: z.number().int().min(0),
  printedText: z.string().min(1),
  childWorkText: z.string().nullable().default(null),
  childAnswer: z.string().nullable().default(null),
  ocrConfidence: z.number().min(0).max(1),
  unreadableNote: z.string().nullable().default(null),
});

export const extractionSchema = z.object({
  problems: z.array(extractedProblemSchema),
  pageNote: z.string().nullable().default(null),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedProblem = z.infer<typeof extractedProblemSchema>;

const methodColumnSchema = z.object({
  title: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1).max(8),
});

export const methodMatchSchema = z.object({
  parentMethod: methodColumnSchema,
  schoolMethod: methodColumnSchema.extend({ svg: z.string().default("") }),
  bothValid: z.boolean().default(true),
  whySchoolWay: z.string().default(""),
});

export const scriptSchema = z.object({
  avoid: z.string().min(1),
  use: z.string().min(1),
});

export const packetSchema = z.object({
  primer: z.string().min(1),
  methodMatch: methodMatchSchema,
  // Exactly five rungs. The UI reveals one per tap and a short ladder would
  // quietly break that contract, so it is enforced here.
  hintLadder: z.array(z.string().min(1)).length(5),
  scripts: z.array(scriptSchema).min(1).max(5),
  lockedAnswer: z.string().default(""),
  isomorphs: z.array(z.string().min(1)).length(3),
  misconceptionNote: z.string().nullable().default(null),
});

export type PacketPayload = z.infer<typeof packetSchema>;
export type MethodMatch = z.infer<typeof methodMatchSchema>;
export type Script = z.infer<typeof scriptSchema>;

export const classificationSchema = z.object({
  label: z.enum(MOVE_LABELS),
  confidence: z.number().min(0).max(1),
});

export type Classification = z.infer<typeof classificationSchema>;

export const recapSchema = z.object({
  recap: z.string().min(1),
  oneThingToTry: z.string().nullable().default(null),
});

export type Recap = z.infer<typeof recapSchema>;

export const teacherNoteSchema = z.object({
  note: z.string().min(1),
});

/**
 * One conversational turn.
 *
 * The intent is separate from the prose on purpose. `answer` means the parent
 * asked for the solution to the problem in front of the child, and the
 * software reveals it behind the press and hold; the model writes the sentence
 * around it and never the answer itself. There is no field here that could
 * carry one.
 *
 * The other intents exist because collapsing them into `answer` is what broke
 * this. "What is a denominator" is a definition, "show me an example" is a
 * worked example on different numbers, and a bare "what" is a request to say
 * the last thing again more simply. None of them is a request for the child's
 * answer, and all three were getting the press and hold.
 */
export const CHAT_INTENTS = [
  "coach",
  "next_question",
  "answer",
  "explain",
  "example",
  "strategy",
  "clarify",
  "redirect",
] as const;
export type ChatIntent = (typeof CHAT_INTENTS)[number];

/**
 * A definition, rendered as a card rather than a paragraph.
 *
 * `forNineYearOld` is a separate field rather than an instruction to write
 * simply, because a parent asking for the child-level version wants the same
 * idea in different words, not the explanation replaced. Keeping both lets the
 * card carry a toggle instead of costing a second turn.
 */
export const explainerSchema = z.object({
  term: z.string().min(1).max(80),
  short: z.string().min(1),
  more: z.string().default(""),
  forNineYearOld: z.string().default(""),
});

/**
 * A method demonstrated end to end, on numbers that are not the child's.
 *
 * `problem` is required and is the safety rail made structural: there is
 * nowhere here to put a walkthrough that does not name the numbers it used, so
 * a worked example on the active problem is visible rather than buried in
 * prose.
 */
export const workedExampleSchema = z.object({
  problem: z.string().min(1).max(120),
  steps: z
    .array(z.object({ move: z.string().min(1), working: z.string().default("") }))
    .min(2)
    .max(8),
  point: z.string().default(""),
});

export const strategySchema = z.object({
  moves: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1).max(3),
  avoid: z.string().default(""),
});

export const chatTurnSchema = z.object({
  intent: z.enum(CHAT_INTENTS),
  /* First in the shape on purpose. The streaming extractor reads this field
     out of the partial JSON as it arrives, so it has to come before the
     structured payloads or a parent watches a blank screen while the card is
     written. */
  reply: z.string().min(1),
  explainer: explainerSchema.nullable().default(null),
  workedExample: workedExampleSchema.nullable().default(null),
  strategy: strategySchema.nullable().default(null),
  /**
   * Two or three next moves, written for this turn.
   *
   * Not a fixed list: what is worth asking after a definition is not what is
   * worth asking after a worked example. Short enough to be a chip.
   */
  chips: z.array(z.string().min(1).max(44)).max(3).default([]),
});

export type Explainer = z.infer<typeof explainerSchema>;
export type WorkedExample = z.infer<typeof workedExampleSchema>;
export type Strategy = z.infer<typeof strategySchema>;

export type ChatTurn = z.infer<typeof chatTurnSchema>;

/**
 * A turn, rendered for the air rather than for a screen.
 *
 * One field, and deliberately only one. There is nowhere here to put an
 * answer, a misconception label or a correction, for the same reason
 * `checkResultSchema` has nowhere to put a correct answer: a shape that
 * cannot carry a thing is a stronger guarantee than a prompt asking it not
 * to. What the shape cannot enforce, `lib/voice.ts` checks before anything
 * is synthesised.
 */
export const voiceTurnSchema = z.object({
  spoken: z.string().min(1),
});

export type VoiceTurn = z.infer<typeof voiceTurnSchema>;

export const misconceptionJudgeSchema = z.object({
  misconceptionId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type MisconceptionJudgement = z.infer<typeof misconceptionJudgeSchema>;

export const checkResultSchema = z.object({
  findings: z
    .array(
      z.object({
        problemIndex: z.number().int().min(0),
        errorType: z.string().min(1),
        plainName: z.string().min(1),
        repairQuestion: z.string().min(1),
      }),
    )
    .default([]),
  allClear: z.boolean().default(false),
});

export type CheckResult = z.infer<typeof checkResultSchema>;
