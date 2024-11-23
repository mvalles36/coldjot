/*
  Warnings:

  - You are about to drop the column `description` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `delay` on the `SequenceStep` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Sequence" DROP CONSTRAINT "Sequence_userId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceStep" DROP CONSTRAINT "SequenceStep_templateId_fkey";

-- DropIndex
DROP INDEX "Sequence_emailListId_idx";

-- DropIndex
DROP INDEX "SequenceStep_templateId_idx";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "sequenceId" TEXT;

-- AlterTable
ALTER TABLE "Sequence" DROP COLUMN "description",
ADD COLUMN     "accessLevel" TEXT NOT NULL DEFAULT 'team',
ADD COLUMN     "scheduleType" TEXT NOT NULL DEFAULT 'business';

-- AlterTable
ALTER TABLE "SequenceStep" DROP COLUMN "delay",
ADD COLUMN     "content" TEXT,
ADD COLUMN     "delayAmount" INTEGER,
ADD COLUMN     "delayUnit" TEXT,
ADD COLUMN     "includeSignature" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'not_sent',
ADD COLUMN     "stepType" TEXT NOT NULL DEFAULT 'manual_email',
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "timing" TEXT NOT NULL DEFAULT 'immediate',
ALTER COLUMN "templateId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
