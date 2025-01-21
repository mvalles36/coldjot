/*
  Warnings:

  - You are about to drop the column `idToken` on the `Mailbox` table. All the data in the column will be lost.
  - You are about to drop the column `tokenType` on the `Mailbox` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Mailbox" DROP COLUMN "idToken",
DROP COLUMN "tokenType",
ADD COLUMN     "id_token" TEXT,
ADD COLUMN     "token_type" TEXT;
