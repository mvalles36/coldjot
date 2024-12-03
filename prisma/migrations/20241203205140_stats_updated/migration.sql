/*
  Warnings:

  - You are about to drop the column `currentStep` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `SequenceStats` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sequenceId]` on the table `SequenceStats` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('SENT', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'SPAM', 'UNSUBSCRIBED');

-- DropForeignKey
ALTER TABLE "SequenceStats" DROP CONSTRAINT "SequenceStats_contactId_fkey";

-- DropIndex
DROP INDEX "SequenceStats_contactId_idx";

-- DropIndex
DROP INDEX "SequenceStats_sequenceId_idx";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "watchExpiration" TIMESTAMP(3),
ADD COLUMN     "watchHistoryId" TEXT;

-- AlterTable
ALTER TABLE "EmailTrackingEvent" ADD COLUMN     "gmailThreadId" TEXT,
ADD COLUMN     "messageId" TEXT;

-- AlterTable
ALTER TABLE "SequenceStats" DROP COLUMN "currentStep",
DROP COLUMN "startedAt",
DROP COLUMN "status",
ADD COLUMN     "avgResponseTime" DOUBLE PRECISION,
ADD COLUMN     "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "bouncedEmails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "clickedEmails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "openRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "openedEmails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repliedEmails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "replyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sentEmails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalEmails" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "contactId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "firstMessageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailEvent_emailId_type_idx" ON "EmailEvent"("emailId", "type");

-- CreateIndex
CREATE INDEX "EmailEvent_sequenceId_type_idx" ON "EmailEvent"("sequenceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_gmailThreadId_key" ON "EmailThread"("gmailThreadId");

-- CreateIndex
CREATE INDEX "EmailThread_gmailThreadId_idx" ON "EmailThread"("gmailThreadId");

-- CreateIndex
CREATE INDEX "EmailThread_sequenceId_idx" ON "EmailThread"("sequenceId");

-- CreateIndex
CREATE INDEX "EmailThread_contactId_idx" ON "EmailThread"("contactId");

-- CreateIndex
CREATE INDEX "EmailThread_userId_idx" ON "EmailThread"("userId");

-- CreateIndex
CREATE INDEX "Account_watchHistoryId_idx" ON "Account"("watchHistoryId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_messageId_idx" ON "EmailTrackingEvent"("messageId");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_gmailThreadId_idx" ON "EmailTrackingEvent"("gmailThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceStats_sequenceId_key" ON "SequenceStats"("sequenceId");

-- AddForeignKey
ALTER TABLE "SequenceStats" ADD CONSTRAINT "SequenceStats_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
