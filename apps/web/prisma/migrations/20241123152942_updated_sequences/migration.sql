-- CreateTable
CREATE TABLE "SequenceStats" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_sent',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SequenceStats_sequenceId_idx" ON "SequenceStats"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceStats_contactId_idx" ON "SequenceStats"("contactId");

-- AddForeignKey
ALTER TABLE "SequenceStats" ADD CONSTRAINT "SequenceStats_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStats" ADD CONSTRAINT "SequenceStats_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
