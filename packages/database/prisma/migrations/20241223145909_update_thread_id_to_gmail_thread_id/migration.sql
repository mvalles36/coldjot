/*
  Warnings:

  - You are about to drop the column `threadId` on the `EmailTracking` table. All the data in the column will be lost.
  - You are about to drop the column `threadId` on the `SequenceContact` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EmailTracking_threadId_idx";

-- AlterTable
ALTER TABLE "EmailTracking" DROP COLUMN "threadId",
ADD COLUMN     "gmailThreadId" TEXT;

-- AlterTable
ALTER TABLE "SequenceContact" DROP COLUMN "threadId",
ADD COLUMN     "gmailThreadId" TEXT;

-- CreateIndex
CREATE INDEX "EmailTracking_gmailThreadId_idx" ON "EmailTracking"("gmailThreadId");
