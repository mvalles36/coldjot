-- CreateIndex
CREATE INDEX "SequenceProgress_sequenceId_idx" ON "SequenceProgress"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceProgress_contactId_idx" ON "SequenceProgress"("contactId");

-- AddForeignKey
ALTER TABLE "SequenceProgress" ADD CONSTRAINT "SequenceProgress_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceProgress" ADD CONSTRAINT "SequenceProgress_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
