/*
  Warnings:

  - Added the required column `email` to the `EmailTrackingEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmailTrackingEvent" ADD COLUMN     "email" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_email_idx" ON "EmailTrackingEvent"("email");
