-- The three shapes a free-text turn can take.
--
-- A definition, a worked example and a teaching strategy are different objects,
-- and rendering all three as a paragraph is why the chat half of the thread
-- looked dead next to the card half. The union in lib/thread.ts gained them and
-- this keeps the enum that persists a thread in step.
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'EXPLAINER';
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'WORKED_EXAMPLE';
ALTER TYPE "MessageKind" ADD VALUE IF NOT EXISTS 'STRATEGY';

-- Restore the vector index if any statement above, or any future migration,
-- dropped it. Idempotent. See 20250401000000_threads_and_messages.
CREATE INDEX IF NOT EXISTS "Standard_embedding_cosine_idx"
  ON "Standard" USING hnsw ("embedding" vector_cosine_ops);
