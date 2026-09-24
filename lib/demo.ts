import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { methodMatchSchema, scriptSchema, type RegisterName } from "@/lib/ai/schemas";
import type { PacketBundle } from "@/lib/types";

/**
 * The cached demo packet.
 *
 * This is the single most important fallback in the product. It backs the
 * landing page "Try it" button, which must cost nothing and must not be able
 * to fail regardless of traffic, and it backs every degraded path: rate
 * limit reached, spend ceiling reached, model down, no API key configured.
 *
 * A reviewer who hits an error page concludes the product is broken. A
 * reviewer who sees a working example with an honest banner concludes the
 * product thought about cost.
 */

const demoPacketSchema = z.object({
  problem: z.object({
    id: z.string(),
    index: z.number(),
    printedText: z.string(),
    childWorkText: z.string().nullable(),
    childAnswer: z.string().nullable(),
    ocrConfidence: z.number().nullable(),
    standardCode: z.string().nullable(),
    /* The saved example is hand matched, not searched, so it has no score.
       Null reads as "not known", which keeps the chip plain rather than
       hedging about a standard somebody chose deliberately. */
    standardSimilarity: z.number().nullable().default(null),
    expectedMethod: z.string().nullable(),
    verified: z.boolean(),
    computedAnswer: z.string().nullable(),
    misconceptionId: z.string().nullable(),
    status: z.enum(["OPEN", "SOLVED", "PARKED"]),
  }),
  standard: z.object({
    code: z.string(),
    // Defaulted rather than required, so an older fixture still parses.
    curriculum: z.string().default("CCSS"),
    grade: z.number(),
    plainLanguage: z.string(),
    expectedMethods: z.array(z.string()),
    parentMethod: z.string(),
  }),
  misconception: z.object({
    id: z.string(),
    topic: z.string(),
    signature: z.string(),
    plainName: z.string(),
    repairQuestion: z.string(),
    visualSvg: z.string().nullable(),
  }),
  language: z.string(),
  packets: z.record(
    z.enum(["PLAIN", "STANDARD", "TECHNICAL"]),
    z.object({
      primer: z.string(),
      methodMatch: methodMatchSchema,
      hintLadder: z.array(z.string()).length(5),
      scripts: z.array(scriptSchema),
      lockedAnswer: z.string(),
      isomorphs: z.array(z.string()).length(3),
      misconceptionNote: z.string().nullable(),
    }),
  ),
});

type DemoFixture = z.infer<typeof demoPacketSchema>;

let cached: DemoFixture | null = null;

async function loadFixture(): Promise<DemoFixture> {
  if (cached) return cached;
  const file = path.join(process.cwd(), "seed", "demo-packet.json");
  const parsed = demoPacketSchema.parse(JSON.parse(await readFile(file, "utf8")));
  cached = parsed;
  return parsed;
}

/**
 * Builds the demo bundle at a given register.
 *
 * The fixture carries all three registers, so the register control on the
 * landing demo switches copy with no model call at all. That keeps the demo
 * genuinely free while still demonstrating the feature.
 */
export async function demoBundle(register: RegisterName, notice: string | null = null): Promise<PacketBundle> {
  const fixture = await loadFixture();
  const packet = fixture.packets[register] ?? fixture.packets.STANDARD;
  if (!packet) throw new Error("Demo fixture is missing a STANDARD packet.");

  return {
    problem: fixture.problem,
    standard: fixture.standard,
    misconception: fixture.misconception,
    packet: { register, language: fixture.language, ...packet },
    /* A fixture is not a search. It asserts one standard by construction, so
       the honest scope is that standard's own curriculum: nothing was chosen
       between and nothing fell back. The fixture carries no similarity either,
       so the chip neither asserts nor hedges on a score it does not have. */
    standardScope: {
      requested: fixture.standard?.curriculum ?? null,
      fellBack: false,
      mixed: false,
    },
    notice,
    source: "fixture",
    verification: "checked",
  };
}

/** The registers the fixture actually carries. */
export async function demoRegisters(): Promise<RegisterName[]> {
  const fixture = await loadFixture();
  return Object.keys(fixture.packets) as RegisterName[];
}
