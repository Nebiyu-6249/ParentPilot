-- Threads and messages: the chat surface.
--
-- On the pgvector index. `Standard.embedding` is now declared in schema.prisma
-- as Unsupported("vector(1536)"), which stopped `prisma migrate diff` from
-- proposing to drop the COLUMN. It still proposes to drop the INDEX, because
-- the HNSW operator class `vector_cosine_ops` has no Prisma syntax.
--
-- Rather than remembering to strip that line from every future migration, the
-- DROP is removed here and the index is recreated idempotently at the bottom.
-- A future migration that drops it will have it restored by the next one, and
-- `npm run check:db` fails if it is ever actually missing.

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('PARENT', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'WORKSHEET', 'ASK', 'MISCONCEPTION', 'METHOD_MATCH', 'ANSWER', 'TEACHING', 'LIVE_SUMMARY', 'PARK_IT');

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "problemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Thread_parentId_updatedAt_idx" ON "Thread"("parentId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Restore the vector index if any statement above, or any future migration,
-- dropped it. Idempotent: a no-op when the index already exists.
CREATE INDEX IF NOT EXISTS "Standard_embedding_cosine_idx"
  ON "Standard" USING hnsw ("embedding" vector_cosine_ops);
