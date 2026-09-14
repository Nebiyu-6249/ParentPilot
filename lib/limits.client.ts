/**
 * Limit constants that are safe to import from a client component.
 *
 * Kept separate from lib/limits.ts because that module imports Prisma, and
 * pulling the query engine into a browser bundle to read one number would be
 * absurd. lib/limits.ts re-exports these so there is still one source.
 */
export const LIMITS = {
  /** Packets per IP per hour. */
  packetsPerHour: 40,
  /** Packets per IP per day. */
  packetsPerDay: 200,
  /** Seconds of fallback Whisper transcription per IP per day. The Web Speech
   *  API is free and unmetered, so this only bites on unsupported browsers. */
  transcribeSecondsPerDay: 30 * 60,
  /** Bytes. One file per request, images only. */
  maxUploadBytes: 6 * 1024 * 1024,
} as const;
