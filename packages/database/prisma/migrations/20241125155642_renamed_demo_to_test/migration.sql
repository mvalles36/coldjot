/*
  Warnings:

  - You are about to drop the column `demoMode` on the `Sequence` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Sequence" DROP COLUMN "demoMode",
ADD COLUMN     "testMode" BOOLEAN NOT NULL DEFAULT false;
