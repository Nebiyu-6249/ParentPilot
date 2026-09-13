import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton.
 *
 * The app is built so that a missing DATABASE_URL degrades to the cached
 * demo packet rather than crashing: the landing page demo, `/privacy` and
 * the design system all work with no database at all. Anything that needs
 * persistence checks `hasDatabase()` first.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Runs a database operation, returning `fallback` if there is no database or
 * the query fails.
 *
 * Used on read paths where a degraded page is far better than an error page.
 * Write paths that must not silently vanish call `prisma` directly.
 */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await fn();
  } catch (error) {
    console.error("[db] query failed", error);
    return fallback;
  }
}
