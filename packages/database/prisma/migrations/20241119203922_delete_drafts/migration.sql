-- DropForeignKey
ALTER TABLE "Draft" DROP CONSTRAINT "Draft_contactId_fkey";

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
