-- CreateTable
CREATE TABLE "EmailTracking" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTracking_emailId_idx" ON "EmailTracking"("emailId");

-- CreateIndex
CREATE INDEX "EmailTracking_userId_idx" ON "EmailTracking"("userId");

-- CreateIndex
CREATE INDEX "EmailTracking_type_idx" ON "EmailTracking"("type");

-- CreateIndex
CREATE INDEX "EmailTracking_createdAt_idx" ON "EmailTracking"("createdAt");
