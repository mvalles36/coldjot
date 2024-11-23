/*
  Warnings:

  - You are about to drop the column `contactId` on the `Sequence` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Sequence" DROP CONSTRAINT "Sequence_contactId_fkey";

-- AlterTable
ALTER TABLE "Sequence" DROP COLUMN "contactId";

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");
