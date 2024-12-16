/*
  Warnings:

  - You are about to drop the column `status` on the `SequenceStep` table. All the data in the column will be lost.
  - You are about to drop the column `threadId` on the `SequenceStep` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SequenceStep" DROP COLUMN "status",
DROP COLUMN "threadId";
