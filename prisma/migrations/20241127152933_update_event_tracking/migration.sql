/*
  Warnings:

  - You are about to drop the column `hashId` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the `EmailTrackingHash` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[hash]` on the table `EmailTrackingEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contactId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hash` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sequenceId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stepId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EmailTrackingEvent" DROP CONSTRAINT "EmailTrackingEvent_hashId_fkey";

-- DropIndex
DROP INDEX "EmailTrackingEvent_hashId_idx";

-- AlterTable
ALTER TABLE "EmailTrackingEvent" DROP COLUMN "hashId",
ADD COLUMN     "contactId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hash" TEXT NOT NULL,
ADD COLUMN     "sequenceId" TEXT NOT NULL,
ADD COLUMN     "stepId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "EmailTrackingHash";

-- CreateIndex
CREATE UNIQUE INDEX "EmailTrackingEvent_hash_key" ON "EmailTrackingEvent"("hash");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_hash_idx" ON "EmailTrackingEvent"("hash");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_userId_idx" ON "EmailTrackingEvent"("userId");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_sequenceId_idx" ON "EmailTrackingEvent"("sequenceId");
