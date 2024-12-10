/*
  Warnings:

  - A unique constraint covering the columns `[sequenceId]` on the table `SequenceStats` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SequenceStats" ADD COLUMN     "bounceRate" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "clickRate" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "interested" INTEGER DEFAULT 0,
ADD COLUMN     "openRate" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "peopleContacted" INTEGER DEFAULT 0,
ADD COLUMN     "replyRate" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "unsubscribed" INTEGER DEFAULT 0,
ALTER COLUMN "bouncedEmails" DROP NOT NULL,
ALTER COLUMN "clickedEmails" DROP NOT NULL,
ALTER COLUMN "openedEmails" DROP NOT NULL,
ALTER COLUMN "repliedEmails" DROP NOT NULL,
ALTER COLUMN "sentEmails" DROP NOT NULL,
ALTER COLUMN "totalEmails" DROP NOT NULL,
ALTER COLUMN "uniqueOpens" DROP NOT NULL,
ALTER COLUMN "failedEmails" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SequenceHealth" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SequenceHealth_sequenceId_key" ON "SequenceHealth"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceHealth_sequenceId_idx" ON "SequenceHealth"("sequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceStats_sequenceId_key" ON "SequenceStats"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceStats_sequenceId_idx" ON "SequenceStats"("sequenceId");

-- AddForeignKey
ALTER TABLE "SequenceHealth" ADD CONSTRAINT "SequenceHealth_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
