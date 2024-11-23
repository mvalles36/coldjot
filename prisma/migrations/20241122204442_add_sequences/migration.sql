/*
  Warnings:

  - You are about to drop the column `emailListId` on the `EmailSequence` table. All the data in the column will be lost.
  - You are about to drop the `EmailSequenceStep` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailSequence" DROP CONSTRAINT "EmailSequence_emailListId_fkey";

-- DropForeignKey
ALTER TABLE "EmailSequence" DROP CONSTRAINT "EmailSequence_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmailSequenceStep" DROP CONSTRAINT "EmailSequenceStep_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "EmailSequenceStep" DROP CONSTRAINT "EmailSequenceStep_templateId_fkey";

-- DropIndex
DROP INDEX "EmailSequence_emailListId_idx";

-- AlterTable
ALTER TABLE "EmailSequence" DROP COLUMN "emailListId";

-- DropTable
DROP TABLE "EmailSequenceStep";

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "waitDays" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SequenceContacts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SequenceLists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceStep_templateId_idx" ON "SequenceStep"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "_SequenceContacts_AB_unique" ON "_SequenceContacts"("A", "B");

-- CreateIndex
CREATE INDEX "_SequenceContacts_B_index" ON "_SequenceContacts"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SequenceLists_AB_unique" ON "_SequenceLists"("A", "B");

-- CreateIndex
CREATE INDEX "_SequenceLists_B_index" ON "_SequenceLists"("B");

-- AddForeignKey
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SequenceContacts" ADD CONSTRAINT "_SequenceContacts_A_fkey" FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SequenceContacts" ADD CONSTRAINT "_SequenceContacts_B_fkey" FOREIGN KEY ("B") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SequenceLists" ADD CONSTRAINT "_SequenceLists_A_fkey" FOREIGN KEY ("A") REFERENCES "EmailList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SequenceLists" ADD CONSTRAINT "_SequenceLists_B_fkey" FOREIGN KEY ("B") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
