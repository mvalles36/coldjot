-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN     "defaultAliasId" TEXT;

-- CreateIndex
CREATE INDEX "EmailAccount_defaultAliasId_idx" ON "EmailAccount"("defaultAliasId");

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_defaultAliasId_fkey" FOREIGN KEY ("defaultAliasId") REFERENCES "EmailAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
