/*
  Warnings:

  - You are about to drop the `LinkClickEvent` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `type` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "LinkClickEvent" DROP CONSTRAINT "LinkClickEvent_trackingId_fkey";

-- AlterTable
ALTER TABLE "EmailTrackingEvent" ADD COLUMN     "type" TEXT NOT NULL;

-- DropTable
DROP TABLE "LinkClickEvent";

-- CreateTable
CREATE TABLE "TrackedLink" (
    "id" TEXT NOT NULL,
    "emailTrackingId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "trackedLinkId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedLink_emailTrackingId_idx" ON "TrackedLink"("emailTrackingId");

-- CreateIndex
CREATE INDEX "LinkClick_trackedLinkId_idx" ON "LinkClick"("trackedLinkId");

-- CreateIndex
CREATE INDEX "LinkClick_timestamp_idx" ON "LinkClick"("timestamp");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_type_idx" ON "EmailTrackingEvent"("type");

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_emailTrackingId_fkey" FOREIGN KEY ("emailTrackingId") REFERENCES "EmailTrackingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_trackedLinkId_fkey" FOREIGN KEY ("trackedLinkId") REFERENCES "TrackedLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
