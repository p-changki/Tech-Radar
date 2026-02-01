-- CreateEnum
CREATE TYPE "FetchJobStatus" AS ENUM ('queued', 'running', 'success', 'failed');

-- AlterTable
ALTER TABLE "Source" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Source" ADD COLUMN "tags" JSONB;
ALTER TABLE "Source" ALTER COLUMN "enabled" SET DEFAULT false;
ALTER TABLE "Source" DROP COLUMN "region";

-- AlterTable
ALTER TABLE "Rule" ALTER COLUMN "weight" TYPE DOUBLE PRECISION USING "weight"::double precision;
ALTER TABLE "Rule" ALTER COLUMN "weight" SET DEFAULT 1.0;

-- AlterTable
ALTER TABLE "FetchRun" ADD COLUMN "result" JSONB;

-- AlterTable
ALTER TABLE "FetchedItem" DROP COLUMN "region";

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "region";

-- CreateTable
CREATE TABLE "Preset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresetSource" (
    "presetId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresetSource_pkey" PRIMARY KEY ("presetId","sourceId")
);

-- CreateTable
CREATE TABLE "FetchJob" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "FetchJobStatus" NOT NULL DEFAULT 'queued',
    "lockedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FetchJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Source_enabled_locale_categoryDefault_idx" ON "Source"("enabled", "locale", "categoryDefault");

-- CreateIndex
CREATE INDEX "FetchedItem_runId_category_publishedAt_idx" ON "FetchedItem"("runId", "category", "publishedAt");

-- CreateIndex
CREATE INDEX "Post_category_savedAt_idx" ON "Post"("category", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FetchJob_runId_key" ON "FetchJob"("runId");

-- AddForeignKey
ALTER TABLE "PresetSource" ADD CONSTRAINT "PresetSource_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetSource" ADD CONSTRAINT "PresetSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FetchJob" ADD CONSTRAINT "FetchJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FetchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropEnum
DROP TYPE "Region";
