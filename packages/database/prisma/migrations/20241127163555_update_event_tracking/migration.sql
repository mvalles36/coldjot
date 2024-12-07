/*
  Warnings:

  - Added the required column `type` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailTrackingEvent" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_type_idx" ON "EmailTrackingEvent"("type");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_timestamp_idx" ON "EmailTrackingEvent"("timestamp");
