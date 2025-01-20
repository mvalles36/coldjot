/*
  Warnings:

  - You are about to drop the column `emailAccountId` on the `EmailAlias` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[mailboxId,alias]` on the table `EmailAlias` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mailboxId` to the `EmailAlias` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "EmailAlias" DROP CONSTRAINT "EmailAlias_emailAccountId_fkey";

-- DropIndex
DROP INDEX "EmailAlias_emailAccountId_alias_key";

-- AlterTable
ALTER TABLE "EmailAlias" DROP COLUMN "emailAccountId",
ADD COLUMN     "mailboxId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EmailAlias_mailboxId_alias_key" ON "EmailAlias"("mailboxId", "alias");

-- AddForeignKey
ALTER TABLE "EmailAlias" ADD CONSTRAINT "EmailAlias_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
