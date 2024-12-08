/*
  Warnings:

  - You are about to drop the column `workHours` on the `BusinessHours` table. All the data in the column will be lost.
  - You are about to drop the column `bounceRate` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `clickRate` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `interested` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `openRate` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `peopleContacted` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `replyRate` on the `SequenceStats` table. All the data in the column will be lost.
  - You are about to drop the column `unsubscribed` on the `SequenceStats` table. All the data in the column will be lost.
  - Added the required column `userId` to the `BusinessHours` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SequenceStats" DROP CONSTRAINT "SequenceStats_sequenceId_fkey";

-- DropIndex
DROP INDEX "SequenceStats_sequenceId_key";

-- AlterTable
ALTER TABLE "BusinessHours" DROP COLUMN "workHours",
ADD COLUMN     "userId" TEXT NOT NULL,
ADD COLUMN     "workHoursEnd" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "workHoursStart" TEXT NOT NULL DEFAULT '09:00',
ALTER COLUMN "sequenceId" DROP NOT NULL,
ALTER COLUMN "timezone" SET DEFAULT 'UTC',
ALTER COLUMN "workDays" SET DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

-- AlterTable
ALTER TABLE "SequenceStats" DROP COLUMN "bounceRate",
DROP COLUMN "clickRate",
DROP COLUMN "interested",
DROP COLUMN "openRate",
DROP COLUMN "peopleContacted",
DROP COLUMN "replyRate",
DROP COLUMN "unsubscribed",
ADD COLUMN     "avgClickTime" DOUBLE PRECISION,
ADD COLUMN     "avgOpenTime" DOUBLE PRECISION,
ADD COLUMN     "avgReplyTime" DOUBLE PRECISION,
ADD COLUMN     "failedEmails" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationId" TEXT;

-- CreateTable
CREATE TABLE "QueueError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "stack" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessHours_userId_idx" ON "BusinessHours"("userId");

-- CreateIndex
CREATE INDEX "BusinessHours_sequenceId_idx" ON "BusinessHours"("sequenceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStats" ADD CONSTRAINT "SequenceStats_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
