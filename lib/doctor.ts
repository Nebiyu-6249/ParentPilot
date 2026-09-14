import { authSecretIsDefault } from "@/lib/auth";
import { prisma, hasDatabase } from "@/lib/db";
import { emailStatus } from "@/lib/email";
import { isConfigured, modelRouting, probeClassifyModel, probeEmbedding } from "@/lib/ai/provider";
import { spendCeilingUsd, spendToday } from "@/lib/limits";

/**
 * Deployment diagnostics.
 *
 * Built because there was no way to tell a working deployment from a degraded
 * one. A missing key, an unseeded embedding column and a live system all
 * render the same landing page, and the first two silently serve the fixture.
 *
 * Every check reports rather than throws, so one broken dependency does not
 * hide the state of the rest.
 */

export type CheckState = "ok" | "warn" | "fail";

export interface DoctorCheck {
  name: string;
  state: CheckState;
  detail: string;
}

export interface DoctorFailure {
  at: string;
  scope: string;
  message: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  failures: DoctorFailure[];
  /** Set when something is broken badly enough that the product is degraded. */
  headline: string | null;
}

function keyFingerprint(): DoctorCheck {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      name: "OPENAI_API_KEY",
      state: "fail",
      detail: "absent. Every model path serves the saved example instead.",
    };
  }
  // Never print the value. Length and last four are enough to tell one key
  // from another when someone has pasted the wrong one.
  return {
    name: "OPENAI_API_KEY",
    state: "ok",
    detail: `present, ${key.length} characters, ending ${key.slice(-4)}`,
  };
}

async function databaseCheck(): Promise<DoctorCheck[]> {
  if (!hasDatabase()) {
    return [
      { name: "Database", state: "fail", detail: "DATABASE_URL is not set. Nothing is persisted." },
      { name: "pgvector", state: "fail", detail: "no database to check" },
    ];
  }

  const out: DoctorCheck[] = [];

  try {
    const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version() AS version`;
    const version = rows[0]?.version?.split(" ").slice(0, 2).join(" ") ?? "connected";
    out.push({ name: "Database", state: "ok", detail: `connected, ${version}` });
  } catch (error) {
    out.push({
      name: "Database",
      state: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
    out.push({ name: "pgvector", state: "fail", detail: "database unreachable" });
    return out;
  }

  try {
    const ext = await prisma.$queryRaw<{ extversion: string }[]>`
      SELECT extversion FROM pg_extension WHERE extname = 'vector'
    `;
    const version = ext[0]?.extversion;
    out.push(
      version
        ? { name: "pgvector", state: "ok", detail: `extension present, version ${version}` }
        : { name: "pgvector", state: "fail", detail: "extension is not installed" },
    );
  } catch (error) {
    out.push({
      name: "pgvector",
      state: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return out;
}

async function corpusCheck(): Promise<{ checks: DoctorCheck[]; retrievalDead: boolean }> {
  if (!hasDatabase()) {
    return {
      checks: [
        { name: "Standards", state: "fail", detail: "no database" },
        { name: "Misconceptions", state: "fail", detail: "no database" },
      ],
      retrievalDead: false,
    };
  }

  try {
    const [standards, misconceptions, embedded] = await Promise.all([
      prisma.standard.count(),
      prisma.misconception.count(),
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*)::bigint AS n FROM "Standard" WHERE embedding IS NOT NULL
      `,
    ]);

    const withEmbedding = Number(embedded[0]?.n ?? 0);
    const retrievalDead = standards > 0 && withEmbedding === 0;

    return {
      retrievalDead,
      checks: [
        {
          name: "Standards",
          state: retrievalDead ? "fail" : withEmbedding < standards ? "warn" : "ok",
          detail: `${standards} total, ${withEmbedding} with an embedding`,
        },
        {
          name: "Misconceptions",
          state: misconceptions >= 20 ? "ok" : "warn",
          detail: `${misconceptions} total`,
        },
      ],
    };
  } catch (error) {
    return {
      retrievalDead: false,
      checks: [
        {
          name: "Standards",
          state: "fail",
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

async function spendCheck(): Promise<DoctorCheck[]> {
  const ceiling = spendCeilingUsd();
  const spent = await spendToday();
  const pct = ceiling > 0 ? (spent / ceiling) * 100 : 0;

  const out: DoctorCheck[] = [
    {
      name: "Spend today",
      state: spent >= ceiling ? "fail" : pct > 80 ? "warn" : "ok",
      detail: `$${spent.toFixed(4)} of $${ceiling.toFixed(2)} (${pct.toFixed(1)}%)`,
    },
  ];

  if (!hasDatabase()) {
    out.push({ name: "Rate buckets", state: "warn", detail: "no database" });
    return out;
  }

  try {
    const active = await prisma.rateBucket.count();
    out.push({ name: "Rate buckets", state: "ok", detail: `${active} active` });
  } catch (error) {
    out.push({
      name: "Rate buckets",
      state: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return out;
}

async function recentFailures(): Promise<DoctorFailure[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.failureLog.findMany({ orderBy: { at: "desc" }, take: 10 });
    return rows.map((r) => ({ at: r.at.toISOString(), scope: r.scope, message: r.message }));
  } catch {
    return [];
  }
}

/** Runs every check. Never throws. */
export async function runDoctor(): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [keyFingerprint()];

  // A deployment running on the fallback signing secret has forgeable
  // sessions, which is worth shouting about.
  checks.push(
    authSecretIsDefault()
      ? {
          name: "AUTH_SECRET",
          state: "fail",
          detail: "absent. Sessions are signed with the development fallback and are forgeable.",
        }
      : { name: "AUTH_SECRET", state: "ok", detail: "set" },
  );

  const mail = emailStatus();
  checks.push({
    name: "Email (Resend)",
    state: mail.configured ? "ok" : "warn",
    detail: mail.configured
      ? `sending as ${mail.from}, key ${mail.keyTail}`
      : "not configured. Sign-in links go to the server log instead of an inbox.",
  });

  // Live model calls, but only when there is a key to call with. Probing
  // without one would report a misleading network error rather than the real
  // problem, which is the missing key.
  if (isConfigured()) {
    const [classify, embedding] = await Promise.all([probeClassifyModel(), probeEmbedding()]);
    checks.push({
      name: `Live model call (${modelRouting.classify})`,
      state: classify.ok ? "ok" : "fail",
      detail: classify.ok ? `responded in ${classify.ms}ms` : classify.error,
    });
    checks.push({
      name: `Embedding call (${modelRouting.embedding})`,
      state: embedding.ok ? "ok" : "fail",
      detail: embedding.ok ? `responded in ${embedding.ms}ms, ${embedding.dimensions} dimensions` : embedding.error,
    });
  } else {
    checks.push({ name: "Live model call", state: "fail", detail: "skipped, no API key" });
    checks.push({ name: "Embedding call", state: "fail", detail: "skipped, no API key" });
  }

  checks.push(...(await databaseCheck()));

  const corpus = await corpusCheck();
  checks.push(...corpus.checks);
  checks.push(...(await spendCheck()));

  const forgeableSessions = authSecretIsDefault();

  const headline = forgeableSessions
    ? "AUTH_SECRET is not set, so session cookies are signed with the development fallback and anyone who knows it can forge one. Set it before this deployment sees a real parent."
    : corpus.retrievalDead
    ? "Standard retrieval is dead. The corpus is imported but nothing carries an embedding, so every problem falls back to no standard match. Re-run the seed with OPENAI_API_KEY set: npm run seed"
    : null;

  return { checks, failures: await recentFailures(), headline };
}
