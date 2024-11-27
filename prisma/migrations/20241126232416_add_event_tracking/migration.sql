-- CreateTable
CREATE TABLE "EmailTrackingEvent" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_hash_idx" ON "EmailTrackingEvent"("hash");

-- CreateIndex
CREATE INDEX "EmailTrackingEvent_userId_idx" ON "EmailTrackingEvent"("userId");
