/*
  Warnings:

  - You are about to drop the column `companyId` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `linkedinUrl` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the `Company` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_companyId_fkey";

-- DropForeignKey
ALTER TABLE "EmailThread" DROP CONSTRAINT "EmailThread_userId_fkey";

-- DropForeignKey
ALTER TABLE "Sequence" DROP CONSTRAINT "Sequence_userId_fkey";

-- DropIndex
DROP INDEX "Contact_companyId_idx";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "companyId",
DROP COLUMN "linkedinUrl",
DROP COLUMN "title";

-- DropTable
DROP TABLE "Company";

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
