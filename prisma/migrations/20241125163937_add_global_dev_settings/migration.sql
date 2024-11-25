/*
  Warnings:

  - You are about to drop the column `devSettings` on the `Sequence` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Sequence" DROP COLUMN "devSettings";

-- CreateTable
CREATE TABLE "DevSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disableSending" BOOLEAN NOT NULL DEFAULT false,
    "testEmails" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DevSettings_userId_key" ON "DevSettings"("userId");

-- CreateIndex
CREATE INDEX "DevSettings_userId_idx" ON "DevSettings"("userId");

-- AddForeignKey
ALTER TABLE "DevSettings" ADD CONSTRAINT "DevSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
