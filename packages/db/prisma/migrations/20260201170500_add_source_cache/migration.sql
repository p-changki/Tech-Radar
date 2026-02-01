

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('AI', 'FE', 'BE', 'DEVOPS');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('rss', 'github', 'npm', 'pypi');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('domain', 'keyword', 'source');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('mute', 'boost');

-- CreateEnum
CREATE TYPE "FetchRunStatus" AS ENUM ('running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('GLOBAL', 'LOCAL');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "categoryDefault" "Category" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "region" "Region" NOT NULL DEFAULT 'GLOBAL',
    "etag" TEXT,
    "lastModified" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "type" "RuleType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "action" "RuleAction" NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchRun" (
    "id" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FetchRunStatus" NOT NULL DEFAULT 'running',
    "params" JSONB NOT NULL,
    "durationMs" INTEGER,
    "error" TEXT,

    CONSTRAINT "FetchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchedItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "sourceId" TEXT,
    "region" "Region" NOT NULL DEFAULT 'GLOBAL',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "signals" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FetchedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "sourceId" TEXT,
    "region" "Region" NOT NULL DEFAULT 'GLOBAL',
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "summaryTldr" TEXT NOT NULL,
    "summaryPoints" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "notes" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawSnapshot" JSONB,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FetchedItem_url_key" ON "FetchedItem"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Post_url_key" ON "Post"("url");

-- AddForeignKey
ALTER TABLE "FetchedItem" ADD CONSTRAINT "FetchedItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FetchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FetchedItem" ADD CONSTRAINT "FetchedItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

