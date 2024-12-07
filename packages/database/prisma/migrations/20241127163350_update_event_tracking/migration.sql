/*
  Warnings:

  - Added the required column `contactId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sequenceId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stepId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailTrackingEvent" ADD COLUMN     "contactId" TEXT NOT NULL,
ADD COLUMN     "sequenceId" TEXT NOT NULL,
ADD COLUMN     "stepId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_userId_idx" ON "EmailTrackingEvent"("userId");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_sequenceId_idx" ON "EmailTrackingEvent"("sequenceId");
