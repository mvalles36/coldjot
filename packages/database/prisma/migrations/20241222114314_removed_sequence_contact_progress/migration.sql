/*
  Warnings:

  - You are about to drop the `SequenceContactProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SequenceContactProgress" DROP CONSTRAINT "SequenceContactProgress_contactId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceContactProgress" DROP CONSTRAINT "SequenceContactProgress_sequenceId_fkey";

-- AlterTable
ALTER TABLE "SequenceContact" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nextScheduledAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "SequenceContactProgress";
