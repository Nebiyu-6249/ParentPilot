/**
 * Database checks. Run only when a DATABASE_URL is available.
 *
 *   DATABASE_URL=... npm run check:db
 *
 * These assert the two privacy invariants against the live schema rather than
 * against the Prisma file, because the promise made on /privacy is about what
 * the database can physically hold, not about what the ORM currently declares.
 * They also exercise the pgvector path, which is raw SQL and therefore invisible
 * to the type checker.
 *
 * Non-destructive: nothing here writes to a product table. The vector round
 * trip uses a temporary table that vanishes with the connection.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let failures = 0;
let checks = 0;

function section(name: string): void {
  console.log(`\n${name}`);
}

function ok(name: string, condition: boolean): void {
  checks += 1;
  if (!condition) failures += 1;
  console.log(`  ${condition ? "ok  " : "FAIL"}  ${name}`);
}

async function columns(table: string): Promise<{ name: string; type: string }[]> {
  const rows = await prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = ${table}
    ORDER BY ordinal_position
  `;
  return rows.map((r) => ({ name: r.column_name, type: r.data_type }));
}

async function main(): Promise<void> {
  section("Migrations are applied");
  {
    const applied = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at
    `;
    ok("both migrations recorded", applied.length >= 2);
    ok("none left unfinished", applied.every((m) => m.finished_at !== null));
  }

  section("Privacy invariants, asserted against the live schema");
  {
    // The promise on /privacy is that only a label and a timestamp are kept.
    // The only text columns Move may have are its own id and its foreign key.
    const move = await columns("Move");
    const textish = move.filter((c) => /char|text/.test(c.type)).map((c) => c.name);
    ok(`Move has no column that could hold a transcript (text columns: ${textish.join(", ")})`,
      textish.every((n) => n === "id" || n === "sessionId"));
    ok("Move keeps a label", move.some((c) => c.name === "label"));
    ok("Move keeps a timestamp offset", move.some((c) => c.name === "tOffset"));

    // There is no child account. Nothing in Child can authenticate.
    const child = await columns("Child");
    const credentials = child.filter((c) =>
      /email|password|hash|token|secret|session|username|login/i.test(c.name),
    );
    ok(`Child carries no credential of any kind (columns: ${child.map((c) => c.name).join(", ")})`,
      credentials.length === 0);

    // Nor is there an image column anywhere, since photos are not retained.
    const assignment = await columns("Assignment");
    ok("Assignment stores page URLs only, never image bytes",
      assignment.every((c) => !/bytea|blob/i.test(c.type)));
  }

  section("pgvector");
  {
    const extension = await prisma.$queryRaw<{ extversion: string }[]>`
      SELECT extversion FROM pg_extension WHERE extname = 'vector'
    `;
    ok(`the vector extension is installed (${extension[0]?.extversion ?? "absent"})`, extension.length === 1);

    const column = await prisma.$queryRaw<{ udt_name: string }[]>`
      SELECT udt_name FROM information_schema.columns
      WHERE table_name = 'Standard' AND column_name = 'embedding'
    `;
    ok("Standard.embedding exists", column.length === 1);

    const index = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'Standard' AND indexname = 'Standard_embedding_cosine_idx'
    `;
    ok("a cosine index is present on it",
      index[0]?.indexdef.includes("vector_cosine_ops") === true);

    // Round trip the literal format and the `<=>` operator used by
    // lib/standards.ts, without touching any product table.
    const dim = 1536;
    const axis = (n: number): string => {
      const v = new Array<number>(dim).fill(0);
      v[n] = 1;
      return `[${v.join(",")}]`;
    };

    await prisma.$executeRawUnsafe(`CREATE TEMP TABLE pp_vec_check (code text, embedding vector(${dim}))`);
    await prisma.$executeRawUnsafe(`INSERT INTO pp_vec_check VALUES ('a', '${axis(0)}'), ('b', '${axis(1)}'), ('c', '${axis(2)}')`);

    const near = await prisma.$queryRawUnsafe<{ code: string; distance: number }[]>(
      `SELECT code, embedding <=> '${axis(1)}'::vector AS distance FROM pp_vec_check ORDER BY embedding <=> '${axis(1)}'::vector`,
    );
    ok("cosine search returns the matching row first", near[0]?.code === "b");
    ok("its distance is zero", Math.abs(Number(near[0]?.distance ?? 1)) < 1e-6);
    ok("an orthogonal row sits at distance one", Math.abs(Number(near[1]?.distance ?? 0) - 1) < 1e-6);
    await prisma.$executeRawUnsafe(`DROP TABLE pp_vec_check`);
  }

  section("Seed corpus in the database");
  {
    const [standards, misconceptions, embedded] = await Promise.all([
      prisma.standard.count(),
      prisma.misconception.count(),
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Standard" WHERE embedding IS NOT NULL`,
    ]);
    ok(`at least 60 standards imported (${standards})`, standards >= 60);
    ok(`exactly 20 misconceptions imported (${misconceptions})`, misconceptions === 20);

    const orphans = await prisma.$queryRaw<{ code: string }[]>`
      SELECT m."standardCode" AS code FROM "Misconception" m
      LEFT JOIN "Standard" s ON s.code = m."standardCode"
      WHERE s.code IS NULL
    `;
    ok("every misconception resolves to a standard", orphans.length === 0);

    const count = Number(embedded[0]?.n ?? 0);
    console.log(
      count === standards
        ? `  note  all ${count} standards carry an embedding, so retrieval is live`
        : `  note  ${count} of ${standards} standards carry an embedding; run "npm run seed" with OPENAI_API_KEY set for retrieval to work`,
    );
  }

  console.log(
    failures === 0 ? `\n${checks} database checks, all passing.` : `\n${checks} database checks, ${failures} FAILING.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
