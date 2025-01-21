/*
  Warnings:

  - You are about to drop the column `messageId` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `session_state` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `watchExpiration` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `watchHistoryId` on the `Account` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Account_watchHistoryId_idx";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "messageId",
DROP COLUMN "session_state",
DROP COLUMN "watchExpiration",
DROP COLUMN "watchHistoryId";
