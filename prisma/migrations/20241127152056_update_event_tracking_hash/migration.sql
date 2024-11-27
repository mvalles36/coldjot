/*
  Warnings:

  - You are about to drop the column `emailId` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `hash` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - Added the required column `hashId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EmailTrackingEvent_emailId_idx";

-- DropIndex
DROP INDEX "EmailTrackingEvent_hash_idx";

-- DropIndex
DROP INDEX "EmailTrackingEvent_userId_idx";

-- AlterTable
ALTER TABLE "EmailTrackingEvent" DROP COLUMN "emailId",
DROP COLUMN "hash",
DROP COLUMN "userId",
ADD COLUMN     "hashId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "EmailTrackingHash" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTrackingHash_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTrackingHash_hash_key" ON "EmailTrackingHash"("hash");

-- CreateIndex
CREATE INDEX "EmailTrackingHash_hash_idx" ON "EmailTrackingHash"("hash");

-- CreateIndex
CREATE INDEX "EmailTrackingHash_emailId_idx" ON "EmailTrackingHash"("emailId");

-- CreateIndex
CREATE INDEX "EmailTrackingHash_userId_idx" ON "EmailTrackingHash"("userId");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_hashId_idx" ON "EmailTrackingEvent"("hashId");

-- AddForeignKey
ALTER TABLE "EmailTrackingEvent" ADD CONSTRAINT "EmailTrackingEvent_hashId_fkey" FOREIGN KEY ("hashId") REFERENCES "EmailTrackingHash"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
