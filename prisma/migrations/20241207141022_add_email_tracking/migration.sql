-- CreateTable
CREATE TABLE "EmailTracking" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "threadId" TEXT,
    "hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bounceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTracking_messageId_key" ON "EmailTracking"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTracking_hash_key" ON "EmailTracking"("hash");

-- CreateIndex
CREATE INDEX "EmailTracking_messageId_idx" ON "EmailTracking"("messageId");

-- CreateIndex
CREATE INDEX "EmailTracking_threadId_idx" ON "EmailTracking"("threadId");

-- CreateIndex
CREATE INDEX "EmailTracking_hash_idx" ON "EmailTracking"("hash");

-- CreateIndex
CREATE INDEX "EmailTracking_status_idx" ON "EmailTracking"("status");
