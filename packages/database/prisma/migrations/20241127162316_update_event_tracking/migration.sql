/*
  Warnings:

  - You are about to drop the column `contactId` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `sequenceId` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `stepId` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `EmailTrackingEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EmailTrackingEvent_sequenceId_idx";

-- DropIndex
DROP INDEX "EmailTrackingEvent_userId_idx";

-- AlterTable
ALTER TABLE "EmailTrackingEvent" DROP COLUMN "contactId",
DROP COLUMN "sequenceId",
DROP COLUMN "stepId",
DROP COLUMN "userId";
