/*
  Warnings:

  - You are about to drop the column `gmailThreadId` on the `EmailTracking` table. All the data in the column will be lost.
  - You are about to drop the column `gmailThreadId` on the `SequenceContact` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EmailTracking_gmailThreadId_idx";

-- AlterTable
ALTER TABLE "EmailTracking" DROP COLUMN "gmailThreadId",
ADD COLUMN     "threadId" TEXT;

-- AlterTable
ALTER TABLE "SequenceContact" DROP COLUMN "gmailThreadId",
ADD COLUMN     "threadId" TEXT;

-- CreateIndex
CREATE INDEX "EmailTracking_threadId_idx" ON "EmailTracking"("threadId");
