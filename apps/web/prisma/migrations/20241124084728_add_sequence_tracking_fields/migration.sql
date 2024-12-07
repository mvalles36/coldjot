-- AlterTable
ALTER TABLE "SequenceContact" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "lastProcessedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SequenceStep" ADD COLUMN     "previousStepId" TEXT;
