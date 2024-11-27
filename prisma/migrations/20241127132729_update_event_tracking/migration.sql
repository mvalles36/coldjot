/*
  Warnings:

  - You are about to drop the `EmailTracking` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `emailId` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metadata` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailTrackingEvent" ADD COLUMN     "emailId" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB NOT NULL;

-- DropTable
DROP TABLE "EmailTracking";

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_emailId_idx" ON "EmailTrackingEvent"("emailId");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_type_idx" ON "EmailTrackingEvent"("type");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_timestamp_idx" ON "EmailTrackingEvent"("timestamp");
