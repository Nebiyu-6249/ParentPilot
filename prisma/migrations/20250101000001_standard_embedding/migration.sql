-- The embedding column for standard retrieval.
--
-- Prisma has no native vector type, so this column is added here by hand and
-- is read and written exclusively through $queryRaw in lib/standards.ts.
-- Prisma's introspection ignores it, which is fine: nothing in the generated
-- client ever needs to select 1536 floats.

ALTER TABLE "Standard" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Cosine distance, matching the `<=>` operator used in lib/standards.ts.
-- The table holds tens of rows today, so this is for growth rather than for
-- present-day speed.
CREATE INDEX IF NOT EXISTS "Standard_embedding_cosine_idx"
  ON "Standard" USING hnsw ("embedding" vector_cosine_ops);
