/*
  Warnings:

  - You are about to drop the column `sequenceId` on the `Contact` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_sequenceId_fkey";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "sequenceId";

-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "contactId" TEXT;

-- CreateTable
CREATE TABLE "SequenceContact" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_sent',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SequenceContact_sequenceId_idx" ON "SequenceContact"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceContact_contactId_idx" ON "SequenceContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceContact_sequenceId_contactId_key" ON "SequenceContact"("sequenceId", "contactId");

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceContact" ADD CONSTRAINT "SequenceContact_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceContact" ADD CONSTRAINT "SequenceContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
