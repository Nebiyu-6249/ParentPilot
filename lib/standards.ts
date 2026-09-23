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
  curriculum: string;
  grade: number;
  plainLanguage: string;
  expectedMethods: string[];
  parentMethod: string;
  distance: number;
}

function toView(row: StandardRow): StandardView {
  return {
    code: row.code,
    curriculum: row.curriculum,
    grade: row.grade,
    plainLanguage: row.plainLanguage,
    expectedMethods: row.expectedMethods,
    parentMethod: row.parentMethod,
  };
}

/**
 * What a search found, and whether it had to leave the child's curriculum to
 * find it.
 *
 * The flag is the whole reason this is a record rather than an array. A parent
 * in Delhi whose problem matched a Common Core standard has been given useful
 * information about the wrong school system, and the difference between that
 * being helpful and being misleading is entirely whether the screen says so.
 */
export interface StandardMatch {
  standards: StandardView[];
  /** The curriculum that was asked for, or null when none was. */
  requested: string | null;
  /** True when the requested curriculum held nothing and the whole corpus was
   *  searched instead. */
  fellBack: boolean;
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
  curriculum: string | null = null,
): Promise<StandardMatch> {
  const empty: StandardMatch = { standards: [], requested: curriculum, fellBack: false };
  if (!hasDatabase()) return empty;

  // One embedding, reused by both passes. The fallback must not cost a second
  // model call: it fires precisely when a parent's curriculum is not loaded,
  // which is the case that should be cheap rather than expensive.
  const embedding = await embed(problemText);
  const literal = vectorLiteral(embedding);

  const search = async (scope: string | null): Promise<StandardView[]> => {
    try {
      const rows = await query(literal, grade, limit, scope);
      return rows.map(toView);
    } catch (error) {
      console.error("[standards] vector search failed", error);
      return [];
    }
  };

  if (curriculum) {
    const scoped = await search(curriculum);
    if (scoped.length > 0) return { standards: scoped, requested: curriculum, fellBack: false };

    /* Nothing in this child's curriculum. Searching the rest of the corpus is
       more useful than returning nothing, and the caller shows a notice
       naming the mismatch, so the parent is never told what the Common Core
       expects while believing it is their own syllabus. */
    const any = await search(null);
    return { standards: any, requested: curriculum, fellBack: any.length > 0 };
  }

  return { standards: await search(null), requested: null, fellBack: false };
}

/**
 * The four shapes of the query, spelled out.
 *
 * Prisma's tagged template is the only safe way to interpolate into raw SQL
 * here, and it cannot take a conditional WHERE clause, so each combination of
 * grade filter and curriculum filter is written once. Verbose, and the
 * alternative is string concatenation into a query that already carries 1536
 * floats.
 */
async function query(
  literal: string,
  grade: number | null,
  limit: number,
  curriculum: string | null,
): Promise<StandardRow[]> {
  if (curriculum === null && grade === null) {
    return prisma.$queryRaw<StandardRow[]>`
      SELECT id, code, curriculum, grade, "plainLanguage", "expectedMethods", "parentMethod",
             embedding <=> ${literal}::vector AS distance
      FROM "Standard"
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${literal}::vector
      LIMIT ${limit}
    `;
  }

  if (curriculum === null) {
    return prisma.$queryRaw<StandardRow[]>`
      SELECT id, code, curriculum, grade, "plainLanguage", "expectedMethods", "parentMethod",
             embedding <=> ${literal}::vector AS distance
      FROM "Standard"
      WHERE embedding IS NOT NULL
        AND grade BETWEEN ${(grade as number) - 1} AND ${(grade as number) + 1}
      ORDER BY embedding <=> ${literal}::vector
      LIMIT ${limit}
    `;
  }

  if (grade === null) {
    return prisma.$queryRaw<StandardRow[]>`
      SELECT id, code, curriculum, grade, "plainLanguage", "expectedMethods", "parentMethod",
             embedding <=> ${literal}::vector AS distance
      FROM "Standard"
      WHERE embedding IS NOT NULL
        AND curriculum = ${curriculum}
      ORDER BY embedding <=> ${literal}::vector
      LIMIT ${limit}
    `;
  }

  return prisma.$queryRaw<StandardRow[]>`
    SELECT id, code, curriculum, grade, "plainLanguage", "expectedMethods", "parentMethod",
           embedding <=> ${literal}::vector AS distance
    FROM "Standard"
    WHERE embedding IS NOT NULL
      AND curriculum = ${curriculum}
      AND grade BETWEEN ${grade - 1} AND ${grade + 1}
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}
  `;
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
          curriculum: row.curriculum,
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
