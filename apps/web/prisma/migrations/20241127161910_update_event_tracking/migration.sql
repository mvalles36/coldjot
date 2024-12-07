/*
  Warnings:

  - You are about to drop the column `createdAt` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `EmailTrackingEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EmailTrackingEvent_timestamp_idx";

-- DropIndex
DROP INDEX "EmailTrackingEvent_type_idx";

-- AlterTable
ALTER TABLE "EmailTrackingEvent" DROP COLUMN "createdAt",
DROP COLUMN "ipAddress",
DROP COLUMN "metadata",
DROP COLUMN "timestamp",
DROP COLUMN "type",
DROP COLUMN "userAgent";
