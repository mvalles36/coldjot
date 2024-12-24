/*
  Warnings:

  - You are about to drop the column `gmailThreadId` on the `EmailThread` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[threadId]` on the table `EmailThread` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `threadId` to the `EmailThread` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EmailThread_gmailThreadId_idx";

-- DropIndex
DROP INDEX "EmailThread_gmailThreadId_key";

-- AlterTable
ALTER TABLE "EmailThread" DROP COLUMN "gmailThreadId",
ADD COLUMN     "threadId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_threadId_key" ON "EmailThread"("threadId");

-- CreateIndex
CREATE INDEX "EmailThread_threadId_idx" ON "EmailThread"("threadId");
