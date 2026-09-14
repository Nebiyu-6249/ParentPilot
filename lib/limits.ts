import { prisma, hasDatabase } from "@/lib/db";

/**
 * Rate limiting and the global spend ceiling, both backed by Postgres.
 *
 * There is no external rate-limit service here on purpose. Postgres is
 * already in the stack, the volumes are small, and one fewer vendor is one
 * fewer thing to explain on the privacy page.
 *
 * The important property is not the limit, it is what happens when the limit
 * is hit: callers serve the cached demo packet with an honest banner. Nothing
 * in this file returns 429 or throws on exhaustion.
 */

export { LIMITS } from "@/lib/limits.client";
import { LIMITS } from "@/lib/limits.client";

export type LimitScope = "packet" | "transcribe" | "extract" | "check";

export interface LimitVerdict {
  allowed: boolean;
  /** Why it was refused, for the honest banner. Null when allowed. */
  reason: "rate" | "spend" | null;
}

const ALLOWED = { allowed: true, reason: null } as const;

function dayKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

function hourWindow(at: Date = new Date()): Date {
  const d = new Date(at);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function dayWindow(at: Date = new Date()): Date {
  const d = new Date(at);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/**
 * Increments a counter for `ip:scope` in the given window and returns the new
 * total. Concurrent requests are handled by the unique constraint plus an
 * upsert, so two racing requests cannot both read a stale count.
 */
async function bump(key: string, windowAt: Date, by = 1): Promise<number> {
  const row = await prisma.rateBucket.upsert({
    where: { key_windowAt: { key, windowAt } },
    create: { key, windowAt, count: by },
    update: { count: { increment: by } },
  });
  return row.count;
}

export function spendCeilingUsd(): number {
  const raw = Number(process.env.DAILY_SPEND_CEILING_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

/** Today's estimated spend in USD. Zero when there is no database. */
export async function spendToday(): Promise<number> {
  if (!hasDatabase()) return 0;
  try {
    const row = await prisma.spendLog.findUnique({ where: { day: dayKey() } });
    return row?.usd ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Adds an estimated cost to today's ledger.
 *
 * Called by `lib/ai/provider.ts` after every model call. Failures here are
 * swallowed: a broken ledger write must never fail a parent's request, and
 * the ceiling check on the next request will still read whatever did land.
 */
export async function recordSpend(usd: number): Promise<void> {
  if (!hasDatabase() || usd <= 0) return;
  try {
    await prisma.spendLog.upsert({
      where: { day: dayKey() },
      create: { day: dayKey(), usd },
      update: { usd: { increment: usd } },
    });
  } catch (error) {
    console.error("[limits] spend ledger write failed", error);
  }
}

/** True when today's estimated spend is at or over the ceiling. */
export async function spendCeilingReached(): Promise<boolean> {
  return (await spendToday()) >= spendCeilingUsd();
}

/**
 * Checks and consumes one unit of quota for a scope.
 *
 * Returns a verdict rather than throwing. With no database configured every
 * request is allowed, since there is nothing to meter against and the demo
 * fixture path costs nothing anyway.
 */
export async function consume(
  ip: string,
  scope: LimitScope,
  units = 1,
): Promise<LimitVerdict> {
  if (await spendCeilingReached()) return { allowed: false, reason: "spend" };
  if (!hasDatabase()) return ALLOWED;

  try {
    if (scope === "transcribe") {
      const used = await bump(`${ip}:transcribe:day`, dayWindow(), units);
      if (used > LIMITS.transcribeSecondsPerDay) return { allowed: false, reason: "rate" };
      return ALLOWED;
    }

    const perHour = await bump(`${ip}:${scope}:hour`, hourWindow(), units);
    const perDay = await bump(`${ip}:${scope}:day`, dayWindow(), units);

    if (perHour > LIMITS.packetsPerHour) return { allowed: false, reason: "rate" };
    if (perDay > LIMITS.packetsPerDay) return { allowed: false, reason: "rate" };

    return ALLOWED;
  } catch (error) {
    // A metering failure should not take the product down. Fail open, since
    // the spend ceiling above is the real backstop against runaway cost.
    console.error("[limits] rate bucket write failed", error);
    return ALLOWED;
  }
}

/** Validates an uploaded file against the upload rules. */
export function validateUpload(file: File | null): { ok: true } | { ok: false; reason: "missing" | "type" | "size" } {
  if (!file) return { ok: false, reason: "missing" };
  if (!file.type.startsWith("image/")) return { ok: false, reason: "type" };
  if (file.size > LIMITS.maxUploadBytes) return { ok: false, reason: "size" };
  return { ok: true };
}

/** Records a failure for the /ops board. Never throws. */
export async function logFailure(scope: string, message: string): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await prisma.failureLog.create({ data: { scope, message: message.slice(0, 500) } });
  } catch {
    // Nothing useful to do if the failure log itself fails.
  }
}

/** Today's call counts by scope, for /ops. */
export async function todayCounts(): Promise<{ key: string; count: number }[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.rateBucket.findMany({
      where: { windowAt: { gte: dayWindow() } },
      orderBy: { count: "desc" },
      take: 50,
    });
    return rows.map((r) => ({ key: r.key, count: r.count }));
  } catch {
    return [];
  }
}
