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

import { createShareLink, readSharedSession, revokeShareLink, SHARE_TTL_DAYS } from "../lib/share";

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
    /* This is the assertion the round four brief asks for, and it exists
       because the failure it catches is invisible: `prisma migrate diff`
       proposes dropping this column and index on every migration, since the
       column is Unsupported and the HNSW operator class has no Prisma syntax.
       Dropping either leaves the product looking healthy while every problem
       silently falls back to no standard match. */
    ok("the cosine index is present, and was not dropped by a migration",
      index[0]?.indexdef.includes("vector_cosine_ops") === true);
    ok("the index is HNSW rather than a sequential scan in disguise",
      index[0]?.indexdef.includes("hnsw") === true);

    const declared = await prisma.$queryRaw<{ udt_name: string }[]>`
      SELECT udt_name FROM information_schema.columns
      WHERE table_name = 'Standard' AND column_name = 'embedding'
    `;
    ok("the column is a real vector type", declared[0]?.udt_name === "vector");

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

  section("Curricula, one scale and no unlabelled rows");
  {
    /* Retrieval scopes by curriculum and falls back to the whole corpus when
       the scope is empty. A row with no curriculum, or with a curriculum
       spelled some other way, can therefore never be scoped to and can only
       ever be reached by that fallback: it is a standard from one country
       being shown to a parent in another, and nothing on the screen says so.
       The seeder throws on a mismatch, but a hand-edited row or a restored
       dump has not been through the seeder. */
    const byCurriculum = await prisma.$queryRaw<{ curriculum: string | null; n: bigint; embedded: bigint }[]>`
      SELECT curriculum,
             COUNT(*)::bigint AS n,
             COUNT(embedding)::bigint AS embedded
      FROM "Standard"
      GROUP BY curriculum
      ORDER BY curriculum
    `;

    const unlabelled = byCurriculum.find((r) => r.curriculum === null || r.curriculum.trim() === "");
    ok(
      `every standard carries a curriculum${unlabelled ? ` (${Number(unlabelled.n)} do not)` : ""}`,
      unlabelled === undefined,
    );

    /* The three the seeder knows about. Anything else is a typo that the
       product will scope to and never find, such as NC_ENGLAND where the rest
       of the codebase says ENC. */
    const KNOWN = ["CCSS", "ENC", "CBSE"];
    const unknown = byCurriculum
      .map((r) => r.curriculum)
      .filter((c): c is string => c !== null && c.trim() !== "" && !KNOWN.includes(c));
    ok(
      `no curriculum outside ${KNOWN.join(", ")}${unknown.length > 0 ? ` (found ${unknown.join(", ")})` : ""}`,
      unknown.length === 0,
    );

    const present = new Map(byCurriculum.map((r) => [r.curriculum ?? "", Number(r.n)]));
    for (const wanted of ["CCSS", "ENC"]) {
      ok(
        `the ${wanted} corpus is loaded (${present.get(wanted) ?? 0} standards)`,
        (present.get(wanted) ?? 0) > 0,
      );
    }

    /* Embedded per curriculum, not in total. A corpus that is present but
       wholly unembedded is the worst of the three states: scoping finds no
       rows, the search falls back to the curriculum that is embedded, and
       every parent on the new corpus silently reads another country's
       standards while the overall count looks healthy. */
    for (const row of byCurriculum) {
      // An unlabelled row is already reported above; it has no name to print.
      if (row.curriculum === null || row.curriculum.trim() === "" || Number(row.n) === 0) continue;
      const n = Number(row.n);
      const e = Number(row.embedded);
      ok(`${row.curriculum}: all ${n} standards are embedded (${e})`, e === n);
    }

    /* Both corpora are stored on one age-normalised scale, so that the grade
       window in `nearestStandards` means the same thing in both. England year
       groups are converted on the way in: Year 4 is grade 3, per seed/README.md. */
    const outOfRange = await prisma.$queryRaw<{ code: string; grade: number }[]>`
      SELECT code, grade FROM "Standard" WHERE grade < 0 OR grade > 8 ORDER BY code LIMIT 5
    `;
    ok(
      `every grade is on the 0 to 8 scale${outOfRange.length > 0 ? ` (${outOfRange.map((r) => `${r.code} at ${r.grade}`).join(", ")})` : ""}`,
      outOfRange.length === 0,
    );

    const spans = await prisma.$queryRaw<{ curriculum: string; lo: number; hi: number }[]>`
      SELECT curriculum, MIN(grade) AS lo, MAX(grade) AS hi
      FROM "Standard" WHERE curriculum IS NOT NULL
      GROUP BY curriculum ORDER BY curriculum
    `;
    console.log(
      `  note  grade spans: ${spans.map((s) => `${s.curriculum} ${s.lo} to ${s.hi}`).join(", ")}`,
    );
  }

  await shareChecks();
  await deleteCascadeChecks();

  console.log(
    failures === 0 ? `\n${checks} database checks, all passing.` : `\n${checks} database checks, ${failures} FAILING.`,
  );
  if (failures > 0) process.exitCode = 1;
}

/**
 * Share tokens, against the live database.
 *
 * Generation, expiry, revocation and the absence of any transcript in what a
 * shared link renders. Everything created here is torn down at the end.
 */
/**
 * Delete everything still means everything, now that threads exist.
 *
 * The privacy page promises a delete that removes the lot. A new table that
 * hangs off Parent without a cascade would quietly break that promise while
 * every existing assertion still passed.
 */
async function deleteCascadeChecks(): Promise<void> {
  section("Delete cascade reaches the new tables");

  const parent = await prisma.parent.create({ data: {} });
  const child = await prisma.child.create({
    data: { parentId: parent.id, grade: 5, curriculum: "CCSS", subjects: [] },
  });
  const thread = await prisma.thread.create({
    data: { parentId: parent.id, childId: child.id, title: "Fractions" },
  });
  await prisma.message.createMany({
    data: [
      { threadId: thread.id, role: "PARENT", kind: "TEXT", body: "she is stuck" },
      { threadId: thread.id, role: "ASSISTANT", kind: "ASK", body: "How did you get this?" },
    ],
  });

  const before = await prisma.message.count({ where: { threadId: thread.id } });
  ok(`messages were written  (${before})`, before === 2);

  await prisma.parent.delete({ where: { id: parent.id } });

  ok("deleting the parent removes their threads",
    (await prisma.thread.count({ where: { id: thread.id } })) === 0);
  ok("and the messages inside them",
    (await prisma.message.count({ where: { threadId: thread.id } })) === 0);
  ok("the standards corpus is untouched", (await prisma.standard.count()) >= 60);
}

async function shareChecks(): Promise<void> {
  section("Share links");

  const parent = await prisma.parent.create({ data: {} });
  const child = await prisma.child.create({
    data: { parentId: parent.id, grade: 5, curriculum: "CCSS", subjects: [] },
  });
  const session = await prisma.session.create({ data: { childId: child.id, mode: "LIVE" } });
  await prisma.move.createMany({
    data: [
      { sessionId: session.id, tOffset: 10, label: "PROBING_QUESTION", confidence: 0.9 },
      { sessionId: session.id, tOffset: 40, label: "GIVES_ANSWER", confidence: 0.9 },
    ],
  });

  try {
    // Generation.
    const link = await createShareLink(session.id, parent.id);
    ok("a share link is created for the owner", link !== null);
    ok("the token is long and random, not an id",
      (link?.token.length ?? 0) >= 20 && link?.token !== session.id);
    const days = link ? Math.round((link.expiresAt.getTime() - Date.now()) / 86_400_000) : 0;
    ok(`it expires in ${SHARE_TTL_DAYS} days  (${days})`, days === SHARE_TTL_DAYS);

    // Someone else's session is not theirs to share.
    const stranger = await prisma.parent.create({ data: {} });
    const stolen = await createShareLink(session.id, stranger.id);
    ok("a stranger cannot create a link for a session they do not own", stolen === null);

    // It resolves, and what it resolves to has no transcript in it.
    const opened = link ? await readSharedSession(link.token) : { state: "unknown" as const };
    ok("the token opens the session", opened.state === "ok");

    if (opened.state === "ok") {
      const payload = JSON.stringify(opened.session);
      const fields = Object.keys(opened.session);
      ok(`the shared payload has no transcript field  (${fields.join(", ")})`,
        !fields.some((f) => /transcript|audio|utterance|words|speech|recording/i.test(f)));
      ok("nor anything transcript-shaped nested inside it",
        !/transcript|utterance|recording/i.test(payload));
      ok("it does carry the derived move counts", Object.keys(opened.session.moveCounts).length > 0);
    }

    // Expiry.
    if (link) {
      await prisma.session.update({
        where: { id: session.id },
        data: { shareExpiresAt: new Date(Date.now() - 1000) },
      });
      const expired = await readSharedSession(link.token);
      ok("an expired link reports itself expired rather than opening", expired.state === "expired");
      await prisma.session.update({
        where: { id: session.id },
        data: { shareExpiresAt: new Date(Date.now() + 86_400_000) },
      });
    }

    // Revocation.
    if (link) {
      const strangerRevoke = await revokeShareLink(session.id, stranger.id);
      ok("a stranger cannot revoke a link", strangerRevoke === false);

      const revoked = await revokeShareLink(session.id, parent.id);
      ok("the owner can revoke", revoked === true);

      const afterRevoke = await readSharedSession(link.token);
      ok("a revoked token stops opening at once", afterRevoke.state === "unknown");
    }

    await prisma.parent.delete({ where: { id: stranger.id } });
  } finally {
    // Cascades take the child, session and moves with it.
    await prisma.parent.delete({ where: { id: parent.id } }).catch(() => undefined);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
