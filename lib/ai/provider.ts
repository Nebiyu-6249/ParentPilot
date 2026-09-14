import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";

import { sanitizeDeep } from "@/lib/copy";
import { recordSpend } from "@/lib/limits";
import { loadPrompt } from "@/lib/ai/prompts";
import {
  checkResultSchema,
  classificationSchema,
  extractionSchema,
  misconceptionJudgeSchema,
  packetSchema,
  recapSchema,
  teacherNoteSchema,
  type CheckResult,
  type Classification,
  type Extraction,
  type MisconceptionJudgement,
  type PacketPayload,
  type Recap,
  type RegisterName,
} from "@/lib/ai/schemas";

/**
 * The only file in the codebase that touches the model SDK.
 *
 * Route handlers call the named task functions below and never construct a
 * client, so swapping provider means editing this file and nothing else.
 * Every call is costed and written to the spend ledger before its result is
 * returned, and every text response is run through `sanitizeDeep` so the
 * em-dash ban holds even when the model ignores the prompt.
 */

/** Model routing. Each is overridable by env so a model can be rolled without a deploy. */
const MODELS = {
  /** Worksheet and handwriting extraction. The hard part. Do not downgrade. */
  vision: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
  /** Packet generation. Frontier text, structured JSON, cached aggressively. */
  packet: process.env.OPENAI_PACKET_MODEL ?? "gpt-4o",
  /** Live move classification. Smallest capable model, text only, every 5s. */
  classify: process.env.OPENAI_CLASSIFY_MODEL ?? "gpt-4o-mini",
  /** Session recap and teacher note. Once per session. */
  recap: process.env.OPENAI_RECAP_MODEL ?? "gpt-4o-mini",
  /** 1536 dimensions, matching the `vector(1536)` column on Standard. */
  embedding: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
} as const;

export type TaskName = keyof typeof MODELS;

/**
 * USD per 1M tokens, used only to estimate spend against the daily ceiling.
 * These are list prices at time of writing and are deliberately rounded up.
 * The ceiling is a safety rail, not an invoice.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

const DEFAULT_PRICE = { input: 3, output: 12 };

const REQUEST_TIMEOUT_MS = 45_000;

export class ModelError extends Error {
  readonly kind: "unconfigured" | "timeout" | "malformed" | "upstream";

  constructor(kind: ModelError["kind"], message: string) {
    super(message);
    this.name = "ModelError";
    this.kind = kind;
  }
}

let client: OpenAI | null = null;

export function isConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient(): OpenAI {
  if (!isConfigured()) {
    throw new ModelError("unconfigured", "OPENAI_API_KEY is not set.");
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
      // Retries are handled here, not in the SDK, because the product
      // contract is "retry once, then serve the cached generic primer".
      maxRetries: 0,
    });
  }
  return client;
}

function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? DEFAULT_PRICE;
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

function parseJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Models occasionally fence JSON despite being told not to.
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    // Last resort: take the outermost brace pair.
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(unfenced.slice(start, end + 1));
      } catch {
        throw new ModelError("malformed", "Model response was not JSON.");
      }
    }
    throw new ModelError("malformed", "Model response was not JSON.");
  }
}

interface CompleteOptions<T> {
  task: TaskName;
  messages: ChatCompletionMessageParam[];
  // Input is `unknown` so that schema defaults are applied on the way out
  // and T binds to the parsed output type, not the raw model JSON.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
  maxTokens?: number;
}

/**
 * One chat completion, parsed and validated, with exactly one retry.
 *
 * The retry covers a timeout or a malformed body, which are the two failure
 * modes the brief names. Anything still failing after that throws, and the
 * caller serves the cached generic primer and says so plainly.
 */
async function complete<T>({
  task,
  messages,
  schema,
  temperature = 0.4,
  maxTokens = 3000,
}: CompleteOptions<T>): Promise<T> {
  const model = MODELS[task];
  const openai = getClient();

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      });

      await recordSpend(
        estimateUsd(
          model,
          response.usage?.prompt_tokens ?? 0,
          response.usage?.completion_tokens ?? 0,
        ),
      );

      const text = response.choices[0]?.message?.content;
      if (!text) throw new ModelError("malformed", "Model returned an empty response.");

      const parsed = schema.safeParse(parseJson(text));
      if (!parsed.success) {
        throw new ModelError("malformed", `Model response failed validation: ${parsed.error.message}`);
      }

      // The em-dash ban is a guarantee, not a request. Enforce it here.
      return sanitizeDeep(parsed.data);
    } catch (error) {
      lastError = error;
      if (error instanceof ModelError && error.kind === "unconfigured") throw error;
      if (attempt === 0) continue;
    }
  }

  if (lastError instanceof ModelError) throw lastError;
  const message = lastError instanceof Error ? lastError.message : "Unknown model error.";
  throw new ModelError("upstream", message);
}

export interface ExtractArgs {
  imageDataUrl: string;
  register: RegisterName;
  language: string;
  grade: number;
}

export async function extractWorksheet(args: ExtractArgs): Promise<Extraction> {
  const system = await loadPrompt("extract-worksheet", {
    REGISTER: args.register,
    LANGUAGE: args.language,
    GRADE: args.grade,
  });

  return complete({
    task: "vision",
    schema: extractionSchema,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe every problem on this page, including the child's handwritten working. Report confidence honestly.",
          },
          { type: "image_url", image_url: { url: args.imageDataUrl, detail: "high" } },
        ],
      },
    ],
  });
}

export interface PacketArgs {
  printedText: string;
  childWorkText: string | null;
  childAnswer: string | null;
  standardCode: string | null;
  standardPlain: string | null;
  expectedMethods: string[];
  parentMethod: string | null;
  computedAnswer: string | null;
  misconception: string | null;
  register: RegisterName;
  language: string;
  grade: number;
}

export async function generatePacket(args: PacketArgs): Promise<PacketPayload> {
  const system = await loadPrompt("generate-packet", {
    REGISTER: args.register,
    LANGUAGE: args.language,
    GRADE: args.grade,
    PRINTED_TEXT: args.printedText,
    CHILD_WORK: args.childWorkText,
    CHILD_ANSWER: args.childAnswer,
    STANDARD_CODE: args.standardCode,
    STANDARD_PLAIN: args.standardPlain,
    EXPECTED_METHODS: args.expectedMethods.join("; "),
    PARENT_METHOD: args.parentMethod,
    COMPUTED_ANSWER: args.computedAnswer,
    MISCONCEPTION: args.misconception,
  });

  return complete({
    task: "packet",
    schema: packetSchema,
    temperature: 0.5,
    maxTokens: 4000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Write the packet for this problem." },
    ],
  });
}

export interface ClassifyArgs {
  window: string;
  register: RegisterName;
  language: string;
}

export async function classifyMove(args: ClassifyArgs): Promise<Classification> {
  const system = await loadPrompt("classify-move", {
    REGISTER: args.register,
    LANGUAGE: args.language,
  });

  return complete({
    task: "classify",
    schema: classificationSchema,
    temperature: 0,
    maxTokens: 80,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `WINDOW:\n${args.window}` },
    ],
  });
}

export interface RecapArgs {
  moveCounts: Record<string, number>;
  autonomyScore: number;
  durationMinutes: number;
  parked: boolean;
  register: RegisterName;
  language: string;
}

export async function generateRecap(args: RecapArgs): Promise<Recap> {
  const system = await loadPrompt("session-recap", {
    REGISTER: args.register,
    LANGUAGE: args.language,
    MOVE_COUNTS: JSON.stringify(args.moveCounts),
    AUTONOMY_SCORE: args.autonomyScore.toFixed(2),
    DURATION: args.durationMinutes,
    PARKED: String(args.parked),
  });

  return complete({
    task: "recap",
    schema: recapSchema,
    temperature: 0.5,
    maxTokens: 600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Write the recap." },
    ],
  });
}

export interface TeacherNoteArgs {
  childName: string | null;
  printedText: string;
  standardPlain: string | null;
  minutes: number;
  misconception: string | null;
  register: RegisterName;
  language: string;
}

export async function generateTeacherNote(args: TeacherNoteArgs): Promise<string> {
  const system = await loadPrompt("teacher-note", {
    REGISTER: args.register,
    LANGUAGE: args.language,
    CHILD_NAME: args.childName,
    PRINTED_TEXT: args.printedText,
    STANDARD_PLAIN: args.standardPlain,
    MINUTES: args.minutes,
    MISCONCEPTION: args.misconception,
  });

  const result = await complete({
    task: "recap",
    schema: teacherNoteSchema,
    temperature: 0.4,
    maxTokens: 400,
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Draft the note." },
    ],
  });

  return result.note;
}

export interface MisconceptionJudgeArgs {
  printedText: string;
  childWorkText: string;
  childAnswer: string | null;
  candidates: { id: string; plainName: string; signature: string }[];
}

/**
 * The judge half of misconception matching. The signature strings are
 * matched heuristically in `lib/misconception.ts` first, and only the
 * shortlist reaches the model, which picks one or refuses.
 */
export async function judgeMisconception(
  args: MisconceptionJudgeArgs,
): Promise<MisconceptionJudgement> {
  const candidateList = args.candidates
    .map((c) => `- id: ${c.id}\n  name: ${c.plainName}\n  looks like: ${c.signature}`)
    .join("\n");

  const system = [
    "You decide whether a child's written working matches one of a fixed list of documented misconceptions.",
    "",
    "Standing rules:",
    "1. Your output is read by software that shows coaching to a parent. Never address the child.",
    "2. Never write an em dash. Use a comma, a full stop, or a colon.",
    "3. Register and language do not apply here, since you emit no prose.",
    "4. Never guess. Returning null is correct and common.",
    "",
    "Pick at most one id from the list. Return null if the working is simply correct,",
    "if it is absent, if it is an arithmetic slip rather than a misunderstanding, or if",
    "nothing on the list genuinely fits. Do not stretch a candidate to fit.",
    "Confidence is your calibrated probability that a careful human coder would agree.",
    "",
    "Candidates:",
    candidateList || "(none)",
    "",
    'Return strict JSON only: { "misconceptionId": "string or null", "confidence": 0.0 }',
  ].join("\n");

  return complete({
    task: "classify",
    schema: misconceptionJudgeSchema,
    temperature: 0,
    maxTokens: 120,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `PROBLEM: ${args.printedText}\nCHILD_WORK:\n${args.childWorkText}\nCHILD_ANSWER: ${args.childAnswer ?? "null"}`,
      },
    ],
  });
}

export interface CheckArgs {
  imageDataUrl: string;
  register: RegisterName;
  language: string;
  grade: number;
}

/**
 * `/check` reads finished work and reports error *types* only.
 *
 * The prompt below deliberately never asks for a correct answer, and the
 * response schema has nowhere to put one, so an answer cannot leak onto
 * that screen even if the model volunteers it.
 */
export async function analyseFinishedWork(args: CheckArgs): Promise<CheckResult> {
  const system = [
    "You are looking at a photograph of a child's finished homework.",
    "",
    "Standing rules:",
    "1. You are writing to the adult. The parent reads this. Never address the child.",
    "2. Never write an em dash. Use a comma, a full stop, or a colon.",
    `3. Register: ${args.register}. PLAIN is short everyday sentences, STANDARD is a school newsletter, TECHNICAL may use correct mathematical vocabulary.`,
    `4. Language: ${args.language}.`,
    "5. Never guess. An empty findings list is a valid and common answer.",
    `Grade: ${args.grade}.`,
    "",
    "**You must never state a correct answer, and never state what the child should have written as a final value.**",
    "Name the kind of mistake and give one question the parent can ask that would surface it.",
    "If the working is sound, return an empty findings array and allClear true.",
    "Do not report presentation, handwriting or neatness as findings.",
    "",
    'Return strict JSON only: { "findings": [ { "problemIndex": 0, "errorType": "string", "plainName": "string", "repairQuestion": "string" } ], "allClear": false }',
  ].join("\n");

  return complete({
    task: "vision",
    schema: checkResultSchema,
    temperature: 0,
    maxTokens: 1200,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "What kinds of mistake are on this page?" },
          { type: "image_url", image_url: { url: args.imageDataUrl, detail: "high" } },
        ],
      },
    ],
  });
}

/** Embeds text for pgvector similarity search over the Standard table. */
export async function embed(text: string): Promise<number[]> {
  const openai = getClient();
  const model = MODELS.embedding;

  const response = await openai.embeddings.create({ model, input: text });
  await recordSpend(estimateUsd(model, response.usage?.total_tokens ?? 0, 0));

  const vector = response.data[0]?.embedding;
  if (!vector) throw new ModelError("malformed", "Embedding response was empty.");
  return vector;
}

/** Embeds many strings in one call. Used by the seed importer. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  const model = MODELS.embedding;

  const response = await openai.embeddings.create({ model, input: texts });
  await recordSpend(estimateUsd(model, response.usage?.total_tokens ?? 0, 0));

  return response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Transcribes a short audio chunk. Fallback only, for browsers without SpeechRecognition. */
export async function transcribeChunk(file: File): Promise<string> {
  const openai = getClient();
  const response = await openai.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1",
    response_format: "text",
  });

  // Whisper is billed by audio minute, not tokens. Three-second chunks at
  // the list rate of $0.006 per minute.
  await recordSpend(0.0003);

  return typeof response === "string" ? response : "";
}

export const modelRouting = MODELS;
