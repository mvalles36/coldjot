-- AlterTable
ALTER TABLE "EmailThread" ADD COLUMN     "lastCheckedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EmailThread_lastCheckedAt_idx" ON "EmailThread"("lastCheckedAt");
