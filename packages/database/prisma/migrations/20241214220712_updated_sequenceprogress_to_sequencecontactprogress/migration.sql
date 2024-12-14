/*
  Warnings:

  - You are about to drop the `SequenceProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SequenceProgress" DROP CONSTRAINT "SequenceProgress_contactId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceProgress" DROP CONSTRAINT "SequenceProgress_sequenceId_fkey";

-- DropTable
DROP TABLE "SequenceProgress";

-- CreateTable
CREATE TABLE "SequenceContactProgress" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceContactProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SequenceContactProgress_sequenceId_idx" ON "SequenceContactProgress"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceContactProgress_contactId_idx" ON "SequenceContactProgress"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceContactProgress_sequenceId_contactId_key" ON "SequenceContactProgress"("sequenceId", "contactId");

-- AddForeignKey
ALTER TABLE "SequenceContactProgress" ADD CONSTRAINT "SequenceContactProgress_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceContactProgress" ADD CONSTRAINT "SequenceContactProgress_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
