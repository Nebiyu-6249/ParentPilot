import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * The /ops gate.
 *
 * One password from the environment, compared in constant time, and a signed
 * cookie rather than the password itself so the secret is not sitting in the
 * browser. This is the only operator surface in the product: there is no
 * admin CRUD panel.
 */

const COOKIE = "pp_ops";

function secret(): string | null {
  const value = process.env.OPS_PASSWORD;
  return value && value.length > 0 ? value : null;
}

function token(password: string): string {
  return createHmac("sha256", password).update("pp-ops-v1").digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function checkPassword(candidate: string): boolean {
  const expected = secret();
  if (!expected) return false;
  return constantTimeEqual(candidate, expected);
}

export async function grantOpsSession(password: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, token(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function isOperator(): Promise<boolean> {
  const expected = secret();
  if (!expected) return false;
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return false;
  return constantTimeEqual(value, token(expected));
}

/** True when no OPS_PASSWORD is configured, so /ops can say so plainly. */
export function opsConfigured(): boolean {
  return secret() !== null;
}
