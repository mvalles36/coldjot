/*
  Warnings:

  - You are about to drop the `SequenceStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_SequenceContacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_SequenceLists` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailSequence" DROP CONSTRAINT "EmailSequence_userId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceStep" DROP CONSTRAINT "SequenceStep_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceStep" DROP CONSTRAINT "SequenceStep_templateId_fkey";

-- DropForeignKey
ALTER TABLE "_SequenceContacts" DROP CONSTRAINT "_SequenceContacts_A_fkey";

-- DropForeignKey
ALTER TABLE "_SequenceContacts" DROP CONSTRAINT "_SequenceContacts_B_fkey";

-- DropForeignKey
ALTER TABLE "_SequenceLists" DROP CONSTRAINT "_SequenceLists_A_fkey";

-- DropForeignKey
ALTER TABLE "_SequenceLists" DROP CONSTRAINT "_SequenceLists_B_fkey";

-- AlterTable
ALTER TABLE "EmailSequence" ADD COLUMN     "emailListId" TEXT;

-- DropTable
DROP TABLE "SequenceStep";

-- DropTable
DROP TABLE "_SequenceContacts";

-- DropTable
DROP TABLE "_SequenceLists";

-- CreateTable
CREATE TABLE "EmailSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delay" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSequenceStep_sequenceId_idx" ON "EmailSequenceStep"("sequenceId");

-- CreateIndex
CREATE INDEX "EmailSequenceStep_templateId_idx" ON "EmailSequenceStep"("templateId");

-- CreateIndex
CREATE INDEX "EmailSequence_emailListId_idx" ON "EmailSequence"("emailListId");

-- AddForeignKey
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_emailListId_fkey" FOREIGN KEY ("emailListId") REFERENCES "EmailList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSequenceStep" ADD CONSTRAINT "EmailSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSequenceStep" ADD CONSTRAINT "EmailSequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
