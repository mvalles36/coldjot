-- CreateTable
CREATE TABLE "ProcessedMessages" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'reply',
  "processed" BOOLEAN NOT NULL DEFAULT true,
  "processingDetails" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProcessedMessages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedMessages_messageId_key" ON "ProcessedMessages"("messageId");

-- CreateIndex
CREATE INDEX "ProcessedMessages_messageId_idx" ON "ProcessedMessages"("messageId");

-- CreateIndex
CREATE INDEX "ProcessedMessages_threadId_idx" ON "ProcessedMessages"("threadId");

-- CreateIndex
CREATE INDEX "ProcessedMessages_userId_idx" ON "ProcessedMessages"("userId");

-- CreateIndex
CREATE INDEX "ProcessedMessages_type_idx" ON "ProcessedMessages"("type");

-- CreateIndex
CREATE INDEX "ProcessedMessages_processed_idx" ON "ProcessedMessages"("processed");

-- AddForeignKey
ALTER TABLE "ProcessedMessages" ADD CONSTRAINT "ProcessedMessages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
