import { cookies } from "next/headers";

import { openSession, sealSession } from "@/lib/auth";
import { prisma, hasDatabase } from "@/lib/db";
import type { RegisterName } from "@/lib/ai/schemas";

/**
 * The one cookie.
 *
 * `pp_session` holds a Parent id and nothing else. It is strictly necessary:
 * without it the app cannot tell one parent's worksheets from another's.
 * There is no analytics cookie, no third party cookie and no tracker, which
 * is why /privacy discloses cookies rather than asking consent for them.
 *
 * If analytics are ever added, this comment stops being true and a consent
 * banner becomes mandatory. See app/privacy/page.tsx.
 */

const COOKIE = "pp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface ParentProfile {
  id: string;
  /** Null for an anonymous profile, which is a first-class state here. */
  email: string | null;
  register: RegisterName;
  anxietyBand: number;
  language: string;
  /** The most recently added child, if any. There is no child account. */
  child: {
    id: string;
    firstName: string | null;
    grade: number | null;
    curriculum: string;
    /** The worksheet's language. Null means it is the parent's. */
    schoolLanguage: string | null;
  } | null;
}

export const DEFAULT_PROFILE: ParentProfile = {
  id: "anonymous",
  email: null,
  register: "STANDARD",
  anxietyBand: 2,
  language: "en",
  child: null,
};

/**
 * Reads the parent id out of the signed cookie.
 *
 * A cookie in the old unsigned format fails the signature check and is
 * treated as absent, which is correct: that format was a bearer token anyone
 * could mint, and it is not worth honouring now that ids carry an identity.
 */
async function readCookie(): Promise<string | null> {
  const store = await cookies();
  return openSession(store.get(COOKIE)?.value);
}

/** Reads the current parent, without creating one. */
export async function currentParent(): Promise<ParentProfile> {
  if (!hasDatabase()) return DEFAULT_PROFILE;

  const id = await readCookie();
  if (!id) return DEFAULT_PROFILE;

  try {
    const parent = await prisma.parent.findUnique({
      where: { id },
      include: { children: { orderBy: { id: "desc" }, take: 1 } },
    });
    if (!parent) return DEFAULT_PROFILE;

    const child = parent.children[0];
    return {
      id: parent.id,
      email: parent.email,
      register: parent.register,
      anxietyBand: parent.anxietyBand,
      language: parent.language,
      child: child
        ? {
            id: child.id,
            firstName: child.firstName,
            grade: child.grade,
            curriculum: child.curriculum,
            schoolLanguage: child.schoolLanguage,
          }
        : null,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/** Reads the current parent, creating one if the cookie is absent. */
export async function ensureParent(): Promise<ParentProfile> {
  if (!hasDatabase()) return DEFAULT_PROFILE;

  const existing = await currentParent();
  if (existing.id !== "anonymous") return existing;

  try {
    const parent = await prisma.parent.create({ data: {} });
    const store = await cookies();
    store.set(COOKIE, sealSession(parent.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
    return {
      id: parent.id,
      email: parent.email,
      register: parent.register,
      anxietyBand: parent.anxietyBand,
      language: parent.language,
      child: null,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/** Clears the session cookie. Used by the delete-everything control. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Signs a parent in by replacing the session cookie. Used after a magic link. */
export async function startSession(parentId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sealSession(parentId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** The raw parent id in the cookie, whether or not it has an account yet. */
export async function currentParentId(): Promise<string | null> {
  return readCookie();
}
