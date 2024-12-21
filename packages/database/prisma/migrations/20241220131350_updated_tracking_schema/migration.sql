/*
  Warnings:

  - You are about to drop the column `emailId` on the `EmailEvent` table. All the data in the column will be lost.
  - You are about to drop the column `bounceInfo` on the `EmailTracking` table. All the data in the column will be lost.
  - You are about to drop the `EmailTrackingEvent` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `trackingId` to the `EmailEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `EmailTracking` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EmailEvent" DROP CONSTRAINT "EmailEvent_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedLink" DROP CONSTRAINT "TrackedLink_emailTrackingId_fkey";

-- DropIndex
DROP INDEX "EmailEvent_emailId_type_idx";

-- DropIndex
DROP INDEX "EmailEvent_sequenceId_type_idx";

-- AlterTable
ALTER TABLE "EmailEvent" DROP COLUMN "emailId",
ADD COLUMN     "trackingId" TEXT NOT NULL,
ALTER COLUMN "sequenceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EmailTracking" DROP COLUMN "bounceInfo",
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sequenceId" TEXT,
ADD COLUMN     "stepId" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "EmailTrackingEvent";

-- DropEnum
DROP TYPE "EmailEventType";

-- CreateIndex
CREATE INDEX "EmailEvent_trackingId_idx" ON "EmailEvent"("trackingId");

-- CreateIndex
CREATE INDEX "EmailEvent_type_idx" ON "EmailEvent"("type");

-- CreateIndex
CREATE INDEX "EmailEvent_timestamp_idx" ON "EmailEvent"("timestamp");

-- CreateIndex
CREATE INDEX "EmailTracking_sequenceId_idx" ON "EmailTracking"("sequenceId");

-- CreateIndex
CREATE INDEX "EmailTracking_userId_idx" ON "EmailTracking"("userId");

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "EmailTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_emailTrackingId_fkey" FOREIGN KEY ("emailTrackingId") REFERENCES "EmailTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
