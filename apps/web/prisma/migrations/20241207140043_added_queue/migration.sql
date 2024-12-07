-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "workDays" INTEGER[],
    "workHours" JSONB NOT NULL,
    "holidays" TIMESTAMP(3)[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueMetrics" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "QueueMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "threshold" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepStatus" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "messageId" TEXT,
    "threadId" TEXT,
    "bounceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StepStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceProgress" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_sequenceId_key" ON "BusinessHours"("sequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "StepStatus_sequenceId_stepId_contactId_key" ON "StepStatus"("sequenceId", "stepId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceProgress_sequenceId_contactId_key" ON "SequenceProgress"("sequenceId", "contactId");

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
