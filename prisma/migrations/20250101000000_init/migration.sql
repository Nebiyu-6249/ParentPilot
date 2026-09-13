-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Register" AS ENUM ('PLAIN', 'STANDARD', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('PHOTO', 'PDF', 'VOICE', 'TEXT');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('OPEN', 'SOLVED', 'PARKED');

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('COACH', 'LIVE');

-- CreateEnum
CREATE TYPE "MoveLabel" AS ENUM ('GIVES_ANSWER', 'PROBING_QUESTION', 'GENERIC_PRAISE', 'SPECIFIC_PRAISE', 'CRITICISM', 'TAKES_OVER', 'PRODUCTIVE_WAIT', 'ANXIETY_STATEMENT', 'ESCALATION', 'NEUTRAL');

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "register" "Register" NOT NULL DEFAULT 'STANDARD',
    "anxietyBand" INTEGER NOT NULL DEFAULT 2,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "firstName" TEXT,
    "grade" INTEGER NOT NULL,
    "curriculum" TEXT NOT NULL DEFAULT 'CCSS',
    "subjects" TEXT[],

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageUrls" TEXT[],

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "printedText" TEXT NOT NULL,
    "childWorkText" TEXT,
    "childAnswer" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "standardCode" TEXT,
    "expectedMethod" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "computedAnswer" TEXT,
    "misconceptionId" TEXT,
    "status" "Status" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Packet" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "register" "Register" NOT NULL,
    "language" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "primer" TEXT NOT NULL,
    "methodMatchJson" JSONB NOT NULL,
    "hintLadderJson" JSONB NOT NULL,
    "scriptsJson" JSONB NOT NULL,
    "lockedAnswer" TEXT NOT NULL,
    "isomorphsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Packet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "mode" "Mode" NOT NULL,
    "autonomyScore" DOUBLE PRECISION,
    "moveCountsJson" JSONB,
    "parked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tOffset" INTEGER NOT NULL,
    "label" "MoveLabel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tOffset" INTEGER NOT NULL,
    "triggerLabel" "MoveLabel" NOT NULL,
    "text" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Misconception" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "standardCode" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "plainName" TEXT NOT NULL,
    "repairQuestion" TEXT NOT NULL,
    "visualSvg" TEXT,

    CONSTRAINT "Misconception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "plainLanguage" TEXT NOT NULL,
    "expectedMethods" TEXT[],
    "parentMethod" TEXT NOT NULL,

    CONSTRAINT "Standard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendLog" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "SpendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailureLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parent_email_key" ON "Parent"("email");

-- CreateIndex
CREATE INDEX "Child_parentId_idx" ON "Child"("parentId");

-- CreateIndex
CREATE INDEX "Assignment_childId_idx" ON "Assignment"("childId");

-- CreateIndex
CREATE INDEX "Problem_assignmentId_idx" ON "Problem"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Packet_cacheKey_key" ON "Packet"("cacheKey");

-- CreateIndex
CREATE INDEX "Packet_problemId_idx" ON "Packet"("problemId");

-- CreateIndex
CREATE INDEX "Session_childId_idx" ON "Session"("childId");

-- CreateIndex
CREATE INDEX "Move_sessionId_idx" ON "Move"("sessionId");

-- CreateIndex
CREATE INDEX "Card_sessionId_idx" ON "Card"("sessionId");

-- CreateIndex
CREATE INDEX "Misconception_standardCode_idx" ON "Misconception"("standardCode");

-- CreateIndex
CREATE UNIQUE INDEX "Standard_code_key" ON "Standard"("code");

-- CreateIndex
CREATE INDEX "Standard_grade_idx" ON "Standard"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "RateBucket_key_windowAt_key" ON "RateBucket"("key", "windowAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpendLog_day_key" ON "SpendLog"("day");

-- CreateIndex
CREATE INDEX "FailureLog_at_idx" ON "FailureLog"("at");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Packet" ADD CONSTRAINT "Packet_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

