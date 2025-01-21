-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "mailboxId" TEXT;

-- CreateIndex
CREATE INDEX "Sequence_mailboxId_idx" ON "Sequence"("mailboxId");

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
