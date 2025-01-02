-- AlterTable
ALTER TABLE "EmailThread" ALTER COLUMN "lastCheckedAt" DROP NOT NULL,
ALTER COLUMN "lastCheckedAt" DROP DEFAULT;
