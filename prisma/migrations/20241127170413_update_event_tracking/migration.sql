/*
  Warnings:

  - You are about to drop the column `metadata` on the `EmailTrackingEvent` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `EmailTrackingEvent` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "EmailTrackingEvent_type_idx";

-- AlterTable
ALTER TABLE "EmailTrackingEvent" DROP COLUMN "metadata",
DROP COLUMN "type";
