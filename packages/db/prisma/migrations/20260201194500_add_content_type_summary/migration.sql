-- AlterTable
ALTER TABLE "FetchedItem" ADD COLUMN "contentTypeHint" TEXT;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Post" ADD COLUMN "summaryTemplateVersion" TEXT NOT NULL DEFAULT 'free-v2';
ALTER TABLE "Post" ADD COLUMN "summaryMeta" JSONB;
