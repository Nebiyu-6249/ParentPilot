import { prisma, hasDatabase } from "@/lib/db";
import { embed } from "@/lib/ai/provider";
import type { StandardView } from "@/lib/types";

/**
 * Standard retrieval over pgvector.
 *
 * Prisma has no native vector type, so the embedding column is added by a
 * raw SQL migration and every read or write that touches it goes through
 * `$queryRaw`. The embedding is never selected into application code, only
 * used inside the ORDER BY, which keeps 1536 floats per row off the wire.
 */

interface StandardRow {
  id: string;
  code: string;
  grade: number;
  plainLanguage: string;
  expectedMethods: string[];
  parentMethod: string;
  distance: number;
}

function toView(row: StandardRow): StandardView {
  return {
    code: row.code,
    grade: row.grade,
    plainLanguage: row.plainLanguage,
    expectedMethods: row.expectedMethods,
    parentMethod: row.parentMethod,
  };
}

/** Formats a JS array as a pgvector literal. */
function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Finds the standards closest to a problem's text by cosine distance.
 *
 * Grade is a filter rather than a ranking signal: a fourth grader's
 * worksheet should not match a sixth grade standard just because the
 * wording is similar, but the window is widened by one year either side
 * because worksheets routinely revisit and preview.
 */
export async function nearestStandards(
  problemText: string,
  grade: number | null,
  limit = 3,
): Promise<StandardView[]> {
  if (!hasDatabase()) return [];

  const embedding = await embed(problemText);
  const literal = vectorLiteral(embedding);

  try {
    const rows =
      grade === null
        ? await prisma.$queryRaw<StandardRow[]>`
            SELECT id, code, grade, "plainLanguage", "expectedMethods", "parentMethod",
                   embedding <=> ${literal}::vector AS distance
            FROM "Standard"
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${literal}::vector
            LIMIT ${limit}
          `
        : await prisma.$queryRaw<StandardRow[]>`
            SELECT id, code, grade, "plainLanguage", "expectedMethods", "parentMethod",
                   embedding <=> ${literal}::vector AS distance
            FROM "Standard"
            WHERE embedding IS NOT NULL
              AND grade BETWEEN ${grade - 1} AND ${grade + 1}
            ORDER BY embedding <=> ${literal}::vector
            LIMIT ${limit}
          `;

    return rows.map(toView);
  } catch (error) {
    console.error("[standards] vector search failed", error);
    return [];
  }
}

/** Writes an embedding for one standard. Used by the seed importer. */
export async function setStandardEmbedding(id: string, embedding: number[]): Promise<void> {
  const literal = vectorLiteral(embedding);
  await prisma.$executeRaw`UPDATE "Standard" SET embedding = ${literal}::vector WHERE id = ${id}`;
}

/** Looks up one standard by its code, without touching the vector column. */
export async function standardByCode(code: string | null): Promise<StandardView | null> {
  if (!code || !hasDatabase()) return null;
  try {
    const row = await prisma.standard.findUnique({ where: { code } });
    return row
      ? {
          code: row.code,
          grade: row.grade,
          plainLanguage: row.plainLanguage,
          expectedMethods: row.expectedMethods,
          parentMethod: row.parentMethod,
        }
      : null;
  } catch {
    return null;
  }
}

/** How many standards carry an embedding. Shown on /ops. */
export async function embeddedStandardCount(): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Standard" WHERE embedding IS NOT NULL
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}
