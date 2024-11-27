/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `EmailTrackingEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EmailTrackingEvent" DROP COLUMN "ipAddress",
DROP COLUMN "userAgent",
ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LinkClickEvent" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "LinkClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkClickEvent_trackingId_idx" ON "LinkClickEvent"("trackingId");

-- CreateIndex
CREATE INDEX "LinkClickEvent_timestamp_idx" ON "LinkClickEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "LinkClickEvent" ADD CONSTRAINT "LinkClickEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "EmailTrackingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
