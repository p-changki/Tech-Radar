-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "collection" TEXT,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'inbox';
