/*
  Warnings:

  - You are about to drop the column `lastCheckedAt` on the `EmailThread` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EmailThread_lastCheckedAt_idx";

-- AlterTable
ALTER TABLE "EmailThread" DROP COLUMN "lastCheckedAt";

-- AlterTable
ALTER TABLE "SequenceContact" ALTER COLUMN "startedAt" DROP NOT NULL,
ALTER COLUMN "startedAt" DROP DEFAULT;
