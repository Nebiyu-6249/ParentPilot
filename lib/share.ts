import { randomBytes } from "node:crypto";

import { autonomyReading } from "@/lib/autonomy";
import { prisma, hasDatabase } from "@/lib/db";
import type { MoveLabelName } from "@/lib/ai/schemas";

/**
 * Read-only share links for a teacher.
 *
 * What a teacher sees is derived entirely from `Move` rows, which hold a
 * label, a confidence and a number of seconds, and no words. There is no
 * transcript column in the database and nothing here reads one, so there is no
 * path from a share token to anything that was said. The shape of
 * `SharedSession` is the guarantee: it has nowhere to put a transcript.
 */

const TOKEN_BYTES = 18;
export const SHARE_TTL_DAYS = 30;

export interface SharedProblem {
  printedText: string;
  childWorkText: string | null;
  misconceptionName: string | null;
  standardCode: string | null;
  standardPlain: string | null;
}

/** Everything a shared link renders. Deliberately has no transcript field. */
export interface SharedSession {
  startedAt: string;
  endedAt: string | null;
  minutes: number;
  childFirstName: string | null;
  grade: number | null;
  autonomyScore: number;
  autonomyReading: string;
  moveCounts: Record<string, number>;
  problems: SharedProblem[];
  teacherNote: string | null;
  parked: boolean;
}

function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export interface ShareLink {
  token: string;
  expiresAt: Date;
}

/** Creates or replaces the share link on a session the parent owns. */
export async function createShareLink(sessionId: string, parentId: string): Promise<ShareLink | null> {
  if (!hasDatabase()) return null;

  try {
    // Ownership is checked here rather than trusted from the client: a session
    // id is not a capability.
    const owned = await prisma.session.findFirst({
      where: { id: sessionId, child: { parentId } },
      select: { id: true },
    });
    if (!owned) return null;

    const token = newToken();
    const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 86_400_000);

    await prisma.session.update({
      where: { id: sessionId },
      data: { shareToken: token, shareExpiresAt: expiresAt },
    });

    return { token, expiresAt };
  } catch (error) {
    console.error("[share] could not create a link", error);
    return null;
  }
}

/** Revokes a link by clearing the token. The old URL stops opening at once. */
export async function revokeShareLink(sessionId: string, parentId: string): Promise<boolean> {
  if (!hasDatabase()) return false;

  try {
    const result = await prisma.session.updateMany({
      where: { id: sessionId, child: { parentId } },
      data: { shareToken: null, shareExpiresAt: null },
    });
    return result.count > 0;
  } catch (error) {
    console.error("[share] could not revoke a link", error);
    return false;
  }
}

export type SharedLookup =
  | { state: "ok"; session: SharedSession }
  | { state: "expired" }
  | { state: "unknown" };

/**
 * Resolves a share token.
 *
 * Selects field by field rather than returning the row, so a column added to
 * `Session` later cannot silently start appearing on a public page.
 */
export async function readSharedSession(token: string): Promise<SharedLookup> {
  if (!hasDatabase() || !token) return { state: "unknown" };

  try {
    const session = await prisma.session.findUnique({
      where: { shareToken: token },
      select: {
        startedAt: true,
        endedAt: true,
        autonomyScore: true,
        moveCountsJson: true,
        parked: true,
        shareExpiresAt: true,
        childId: true,
        child: { select: { firstName: true, grade: true } },
        moves: { select: { label: true } },
      },
    });

    if (!session) return { state: "unknown" };
    if (session.shareExpiresAt && session.shareExpiresAt.getTime() < Date.now()) {
      return { state: "expired" };
    }

    const problems = await prisma.problem.findMany({
      where: { assignment: { childId: session.childId } },
      orderBy: { id: "desc" },
      take: 5,
      select: {
        printedText: true,
        childWorkText: true,
        standardCode: true,
        misconceptionId: true,
      },
    });

    const codes = [...new Set(problems.map((p) => p.standardCode).filter((c): c is string => Boolean(c)))];
    const misconceptionIds = [
      ...new Set(problems.map((p) => p.misconceptionId).filter((m): m is string => Boolean(m))),
    ];

    const [standards, misconceptions] = await Promise.all([
      codes.length
        ? prisma.standard.findMany({ where: { code: { in: codes } }, select: { code: true, plainLanguage: true } })
        : Promise.resolve([]),
      misconceptionIds.length
        ? prisma.misconception.findMany({ where: { id: { in: misconceptionIds } }, select: { id: true, plainName: true } })
        : Promise.resolve([]),
    ]);

    const plainByCode = new Map(standards.map((s) => [s.code, s.plainLanguage]));
    const nameById = new Map(misconceptions.map((m) => [m.id, m.plainName]));

    const counts = (session.moveCountsJson ?? {}) as Record<string, number>;
    const derived: Record<string, number> = Object.keys(counts).length
      ? counts
      : session.moves.reduce<Record<string, number>>((acc, move) => {
          const label = move.label as MoveLabelName;
          acc[label] = (acc[label] ?? 0) + 1;
          return acc;
        }, {});

    const score = session.autonomyScore ?? 0;
    const ended = session.endedAt ?? new Date();

    return {
      state: "ok",
      session: {
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        minutes: Math.max(1, Math.round((ended.getTime() - session.startedAt.getTime()) / 60_000)),
        childFirstName: session.child.firstName,
        grade: session.child.grade,
        autonomyScore: score,
        autonomyReading: autonomyReading(score),
        moveCounts: derived,
        problems: problems.map((p) => ({
          printedText: p.printedText,
          childWorkText: p.childWorkText,
          misconceptionName: p.misconceptionId ? (nameById.get(p.misconceptionId) ?? null) : null,
          standardCode: p.standardCode,
          standardPlain: p.standardCode ? (plainByCode.get(p.standardCode) ?? null) : null,
        })),
        // The drafted note is not stored, so a shared link never carries one.
        // It is the parent's to send, not ours to publish.
        teacherNote: null,
        parked: session.parked,
      },
    };
  } catch (error) {
    console.error("[share] lookup failed", error);
    return { state: "unknown" };
  }
}
