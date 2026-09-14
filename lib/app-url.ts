/**
 * Resolves the app's absolute base URL.
 *
 * Exists because `process.env.NEXT_PUBLIC_APP_URL ?? fallback` is wrong in the
 * one case that matters: `??` only substitutes on null and undefined, and on
 * Vercel the variable is commonly *defined but empty*. That produced an empty
 * string, and `new URL("")` throws `ERR_INVALID_URL` during "Collecting page
 * data", failing the production build on /_not-found before any page renders.
 *
 * So every candidate is trimmed, checked for emptiness, and then proved valid
 * by actually constructing a URL from it. A malformed value falls through to
 * the next option rather than taking the build down.
 *
 * **This function must never throw.** It is called at module scope in
 * `app/layout.tsx`, where a throw is a failed build rather than a failed
 * request.
 */

/** Ordered candidates. The first that yields a valid absolute URL wins. */
function candidates(): (string | undefined)[] {
  return [
    // 1. Explicitly configured. Written out in full rather than read through a
    //    variable because Next inlines this exact expression at build time.
    process.env.NEXT_PUBLIC_APP_URL,
    // 2. Vercel's stable production domain. Set automatically, and carries no
    //    protocol, so it needs one adding.
    withProtocol(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    // 3. The per-deployment URL. Also protocol-less. Changes every deploy, so
    //    it is a fallback rather than a default.
    withProtocol(process.env.VERCEL_URL),
  ];
}

const FALLBACK = "http://localhost:3000";

/** Adds `https://` to a bare host, leaving anything already schemed alone. */
function withProtocol(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Returns the candidate as a normalised absolute URL, or null if it is not one.
 *
 * The protocol check rejects values that would parse as a URL but are useless
 * as a site origin, such as `mailto:x` or `javascript:x`, so those degrade to
 * the next candidate instead of reaching an OG tag.
 */
function normalise(candidate: string | undefined): string | null {
  if (candidate === undefined) return null;
  const trimmed = candidate.trim();
  if (trimmed === "") return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return stripTrailingSlash(url.href);
  } catch {
    return null;
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * The app's absolute base URL, with no trailing slash.
 *
 * Always returns a string that `new URL()` accepts. Not memoised, so a change
 * to the environment is picked up on the next call.
 */
export function resolveAppUrl(): string {
  for (const candidate of candidates()) {
    const resolved = normalise(candidate);
    if (resolved !== null) return resolved;
  }
  return FALLBACK;
}
