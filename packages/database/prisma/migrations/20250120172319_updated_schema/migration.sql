/*
  Warnings:

  - You are about to drop the column `settings` on the `Mailbox` table. All the data in the column will be lost.
  - Made the column `providerAccountId` on table `Mailbox` required. This step will fail if there are existing NULL values in that column.
  - Made the column `type` on table `Mailbox` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Mailbox" DROP COLUMN "settings",
ALTER COLUMN "providerAccountId" SET NOT NULL,
ALTER COLUMN "type" SET NOT NULL;
