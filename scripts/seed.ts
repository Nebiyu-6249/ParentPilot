/**
 * Seed importer.
 *
 * Reads the three hand-written JSON files in /seed, upserts them, and embeds
 * every standard so that pgvector retrieval works. Safe to run repeatedly:
 * standards and misconceptions are upserted by id, and embeddings are only
 * recomputed for rows that do not have one, so a re-run after a content edit
 * costs nothing unless you pass --reembed.
 *
 *   npm run seed
 *   npm run seed -- --reembed
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { embedBatch } from "../lib/ai/provider";

const prisma = new PrismaClient();

interface StandardSeed {
  id: string;
  code: string;
  /** Optional in the file, because one file is one curriculum and the reader
   *  fills it in. Present here so a mismatch can be caught rather than
   *  silently relabelled. */
  curriculum?: string;
  grade: number;
  plainLanguage: string;
  expectedMethods: string[];
  parentMethod: string;
}

interface MisconceptionSeed {
  id: string;
  topic: string;
  standardCode: string;
  signature: string;
  plainName: string;
  repairQuestion: string;
  visualSvg: string | null;
}

async function readSeed<T>(name: string): Promise<T> {
  const file = path.join(process.cwd(), "seed", name);
  return JSON.parse(await readFile(file, "utf8")) as T;
}

/**
 * The text a standard is embedded as.
 *
 * Deliberately includes the plain-language description and the expected
 * methods, not just the code, because the query side is a problem written
 * the way a worksheet writes it, not a standards code.
 */
function embeddingText(s: StandardSeed): string {
  return [
    `Grade ${s.grade}.`,
    s.plainLanguage,
    `Methods taught: ${s.expectedMethods.join("; ")}.`,
    `Traditional method: ${s.parentMethod}`,
  ].join(" ");
}

/**
 * Every curriculum's file, read together.
 *
 * One file per curriculum so that England and CBSE can be filled in without
 * touching a corpus that already works. A file that is absent, or that holds
 * only the shape entry, contributes nothing and does not stop the others.
 */
const CURRICULUM_FILES = [
  { file: "standards.json", curriculum: "CCSS" },
  { file: "standards-england.json", curriculum: "ENC" },
  { file: "standards-cbse.json", curriculum: "CBSE" },
] as const;

/** Either a bare array, or `{ standards: [...] }` with a note beside it. */
function unwrap(raw: unknown): StandardSeed[] {
  if (Array.isArray(raw)) return raw as StandardSeed[];
  const wrapped = (raw as { standards?: unknown })?.standards;
  return Array.isArray(wrapped) ? (wrapped as StandardSeed[]) : [];
}

async function readAllStandards(): Promise<StandardSeed[]> {
  const out: StandardSeed[] = [];

  for (const { file, curriculum } of CURRICULUM_FILES) {
    const raw = await readSeed<unknown>(file).catch(() => null);
    if (raw === null) {
      console.log(`  ${file}: not present, skipping.`);
      continue;
    }

    // The shape entry in an unfilled file is documentation, not data.
    const entries = unwrap(raw).filter((s) => !s.id.startsWith("EXAMPLE"));
    const tagged = entries.map((s) => ({ ...s, curriculum: s.curriculum ?? curriculum }));

    const wrong = tagged.filter((s) => s.curriculum !== curriculum);
    if (wrong.length > 0) {
      throw new Error(
        `${file} contains ${wrong.length} entr${wrong.length === 1 ? "y" : "ies"} whose curriculum ` +
          `is not ${curriculum}: ${wrong.map((s) => s.id).join(", ")}. ` +
          "One file per curriculum, so this is a copy and paste rather than a decision.",
      );
    }

    console.log(`  ${file}: ${tagged.length} ${curriculum} standard(s).`);
    out.push(...tagged);
  }

  const seen = new Map<string, string>();
  for (const s of out) {
    const clash = seen.get(s.id);
    if (clash) throw new Error(`Duplicate standard id ${s.id}, in both ${clash} and another file.`);
    seen.set(s.id, s.curriculum ?? "?");
  }

  return out;
}

async function importStandards(reembed: boolean): Promise<void> {
  const standards = await readAllStandards();
  console.log(`Importing ${standards.length} standards.`);

  for (const s of standards) {
    await prisma.standard.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        code: s.code,
        curriculum: s.curriculum ?? "CCSS",
        grade: s.grade,
        plainLanguage: s.plainLanguage,
        expectedMethods: s.expectedMethods,
        parentMethod: s.parentMethod,
      },
      update: {
        code: s.code,
        curriculum: s.curriculum ?? "CCSS",
        grade: s.grade,
        plainLanguage: s.plainLanguage,
        expectedMethods: s.expectedMethods,
        parentMethod: s.parentMethod,
      },
    });
  }

  const missing = reembed
    ? standards
    : await (async () => {
        const rows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Standard" WHERE embedding IS NULL
        `;
        const ids = new Set(rows.map((r) => r.id));
        return standards.filter((s) => ids.has(s.id));
      })();

  if (missing.length === 0) {
    console.log("All standards already carry an embedding. Pass --reembed to force.");
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      `Skipping embeddings for ${missing.length} standards: OPENAI_API_KEY is not set.\n` +
        "Standard retrieval will fall back to no match until this is run again with a key.",
    );
    return;
  }

  console.log(`Embedding ${missing.length} standards.`);
  const batchSize = 32;

  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize);
    const vectors = await embedBatch(batch.map(embeddingText));

    for (let j = 0; j < batch.length; j += 1) {
      const standard = batch[j];
      const vector = vectors[j];
      if (!standard || !vector) continue;
      const literal = `[${vector.join(",")}]`;
      await prisma.$executeRaw`UPDATE "Standard" SET embedding = ${literal}::vector WHERE id = ${standard.id}`;
    }

    console.log(`  embedded ${Math.min(i + batchSize, missing.length)} / ${missing.length}`);
  }
}

async function importMisconceptions(): Promise<void> {
  const misconceptions = await readSeed<MisconceptionSeed[]>("misconceptions.json");
  console.log(`Importing ${misconceptions.length} misconceptions.`);

  for (const m of misconceptions) {
    await prisma.misconception.upsert({
      where: { id: m.id },
      create: m,
      update: m,
    });
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Nothing to seed.");
  }

  const reembed = process.argv.includes("--reembed");

  await importStandards(reembed);
  await importMisconceptions();

  const [standards, misconceptions, embedded] = await Promise.all([
    prisma.standard.count(),
    prisma.misconception.count(),
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM "Standard" WHERE embedding IS NOT NULL`,
  ]);

  console.log(
    `Done. ${standards} standards (${Number(embedded[0]?.count ?? 0)} embedded), ${misconceptions} misconceptions.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
