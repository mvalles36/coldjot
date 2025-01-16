/*
  Warnings:

  - You are about to drop the `DevSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DevSettings" DROP CONSTRAINT "DevSettings_userId_fkey";

-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "disableSending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "DevSettings";
