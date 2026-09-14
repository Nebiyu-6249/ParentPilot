import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma, hasDatabase } from "@/lib/db";

/**
 * Parent accounts. Email and a single-use link, nothing else.
 *
 * There is no child account here and there is no code path that could create
 * one: this module only ever reads and writes `Parent`.
 *
 * Two things are deliberate.
 *
 * The session cookie is signed. It used to hold a bare `Parent.id`, which was
 * tolerable while every session was anonymous and the id identified nothing.
 * Once an id is attached to an email address, an unsigned cookie is account
 * takeover for anyone who can obtain or guess one, and a cuid embeds a
 * timestamp and a counter rather than being random.
 *
 * The link token is never stored. Only its SHA-256 hash is, so a leaked
 * database hands over expired hashes rather than live sign-in links.
 */

const LINK_TTL_MINUTES = 15;
const TOKEN_BYTES = 32;

/**
 * The signing secret.
 *
 * A missing `AUTH_SECRET` falls back to a fixed development value so local
 * work is not blocked, and `/ops/doctor` reports it loudly, because a
 * deployment running on the development secret has forgeable sessions.
 */
function secret(): string {
  return process.env.AUTH_SECRET ?? "parentpilot-development-secret-not-for-deployment";
}

export function authSecretIsDefault(): boolean {
  return !process.env.AUTH_SECRET;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** The value stored in the session cookie: an id plus its signature. */
export function sealSession(parentId: string): string {
  return `${parentId}.${sign(parentId)}`;
}

/**
 * Reads a session cookie, returning the parent id only if the signature holds.
 *
 * An unsigned cookie from before this existed fails here and the visitor gets
 * a fresh anonymous session, which is the correct outcome: the old format was
 * a bearer token that anyone could mint.
 */
export function openSession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const at = raw.lastIndexOf(".");
  if (at <= 0) return null;

  const parentId = raw.slice(0, at);
  const signature = raw.slice(at + 1);
  if (!parentId || !signature) return null;

  return constantTimeEqual(signature, sign(parentId)) ? parentId : null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedLink {
  token: string;
  expiresAt: Date;
}

/**
 * Issues a single-use sign-in link for an address.
 *
 * Returns the raw token to be emailed. It is not persisted and cannot be
 * recovered afterwards, so a link that is not delivered is simply dead.
 */
export async function issueMagicLink(email: string): Promise<IssuedLink | null> {
  if (!hasDatabase()) return null;

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60_000);

  try {
    // Any link already outstanding for this address is retired, so a second
    // request invalidates the first rather than leaving two live.
    await prisma.magicLink.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.magicLink.create({
      data: { email, tokenHash: hashToken(token), expiresAt },
    });

    return { token, expiresAt };
  } catch (error) {
    console.error("[auth] could not issue a sign-in link", error);
    return null;
  }
}

export type ConsumeResult =
  | { ok: true; parentId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "unavailable" };

/**
 * Spends a sign-in link and returns the parent it belongs to.
 *
 * Creates the Parent on first sign-in. If the browser already carries an
 * anonymous parent, `adoptParentId` is merged into the account instead, so a
 * parent who worked through a worksheet before signing up keeps it.
 */
export async function consumeMagicLink(
  token: string,
  adoptParentId: string | null,
): Promise<ConsumeResult> {
  if (!hasDatabase()) return { ok: false, reason: "unavailable" };

  try {
    const link = await prisma.magicLink.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!link) return { ok: false, reason: "invalid" };
    if (link.usedAt) return { ok: false, reason: "used" };
    if (link.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

    // Spend it first. A crash after this point costs the parent one retry;
    // a crash before it would leave the link replayable.
    await prisma.magicLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });

    const existing = await prisma.parent.findUnique({ where: { email: link.email } });
    if (existing) {
      await prisma.parent.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: new Date() },
      });
      return { ok: true, parentId: existing.id };
    }

    // Adopt the anonymous profile this browser was already using, so the
    // worksheet they did before signing up is still theirs afterwards.
    if (adoptParentId) {
      const anonymous = await prisma.parent.findUnique({ where: { id: adoptParentId } });
      if (anonymous && anonymous.email === null) {
        await prisma.parent.update({
          where: { id: anonymous.id },
          data: { email: link.email, emailVerifiedAt: new Date() },
        });
        return { ok: true, parentId: anonymous.id };
      }
    }

    const created = await prisma.parent.create({
      data: { email: link.email, emailVerifiedAt: new Date() },
    });
    return { ok: true, parentId: created.id };
  } catch (error) {
    console.error("[auth] could not consume a sign-in link", error);
    return { ok: false, reason: "unavailable" };
  }
}

/** Removes expired and spent links. Called opportunistically on sign-in. */
export async function pruneMagicLinks(): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await prisma.magicLink.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date(Date.now() - 86_400_000) } }, { usedAt: { not: null } }] },
    });
  } catch {
    // Housekeeping. Never worth failing a sign-in over.
  }
}

export const AUTH_LINK_TTL_MINUTES = LINK_TTL_MINUTES;
