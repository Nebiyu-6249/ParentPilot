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
