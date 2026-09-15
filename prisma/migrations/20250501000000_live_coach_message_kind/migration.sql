-- A live coaching interruption is a kind of message.
--
-- Live Mode moved into the thread, so the card it raises mid-session is a turn
-- like any other rather than an overlay on a separate screen. The card union in
-- lib/thread.ts gained `live_coach`, and this keeps the enum that persists a
-- thread in step with it. Without this, a stored thread could not hold the one
-- kind of turn Live Mode actually produces while it is running.
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'LIVE_COACH';

-- Restore the vector index if any statement above, or any future migration,
-- dropped it. Idempotent: a no-op when the index already exists. See the note
-- in 20250401000000_threads_and_messages.
CREATE INDEX IF NOT EXISTS "Standard_embedding_cosine_idx"
  ON "Standard" USING hnsw ("embedding" vector_cosine_ops);
