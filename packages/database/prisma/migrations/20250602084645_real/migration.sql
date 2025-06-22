/*
  Warnings:

  - You are about to drop the `CallTracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,email]` on the table `Contact` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `firstName` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Contact` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `EmailList` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `ListSyncRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Sequence` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CallTracking" DROP CONSTRAINT "CallTracking_contactId_fkey";

-- DropForeignKey
ALTER TABLE "CallTracking" DROP CONSTRAINT "CallTracking_sequenceId_fkey";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "EmailList" ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "ListSyncRecord" ADD COLUMN     "contactsAdded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "accessLevel" TEXT NOT NULL DEFAULT 'team',
ADD COLUMN     "disableSending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB DEFAULT '{}',
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "scheduleType" TEXT NOT NULL DEFAULT 'business',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "testEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "testMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "image" TEXT,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingData" JSONB,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user',
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "CallTracking";

-- DropTable
DROP TABLE "VerificationToken";

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "gmailDraftId" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepType" TEXT NOT NULL DEFAULT 'manual_email',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "timing" TEXT NOT NULL DEFAULT 'immediate',
    "delayAmount" INTEGER,
    "delayUnit" TEXT,
    "subject" TEXT DEFAULT '',
    "content" TEXT,
    "includeSignature" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "order" INTEGER NOT NULL,
    "previousStepId" TEXT,
    "replyToThread" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceContact" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_sent',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextScheduledAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "lastProcessedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "threadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStats" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT,
    "totalEmails" INTEGER DEFAULT 0,
    "sentEmails" INTEGER DEFAULT 0,
    "openedEmails" INTEGER DEFAULT 0,
    "uniqueOpens" INTEGER DEFAULT 0,
    "clickedEmails" INTEGER DEFAULT 0,
    "repliedEmails" INTEGER DEFAULT 0,
    "bouncedEmails" INTEGER DEFAULT 0,
    "failedEmails" INTEGER DEFAULT 0,
    "unsubscribed" INTEGER DEFAULT 0,
    "interested" INTEGER DEFAULT 0,
    "peopleContacted" INTEGER DEFAULT 0,
    "openRate" DOUBLE PRECISION DEFAULT 0,
    "clickRate" DOUBLE PRECISION DEFAULT 0,
    "replyRate" DOUBLE PRECISION DEFAULT 0,
    "bounceRate" DOUBLE PRECISION DEFAULT 0,
    "avgOpenTime" DOUBLE PRECISION,
    "avgClickTime" DOUBLE PRECISION,
    "avgReplyTime" DOUBLE PRECISION,
    "avgResponseTime" DOUBLE PRECISION,

    CONSTRAINT "SequenceStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceHealth" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTracking" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "threadId" TEXT,
    "hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB NOT NULL,
    "sequenceId" TEXT,
    "stepId" TEXT,
    "contactId" TEXT,
    "userId" TEXT NOT NULL,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "templateId" TEXT,

    CONSTRAINT "EmailTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trackingId" TEXT NOT NULL,
    "contactId" TEXT,
    "sequenceId" TEXT,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedLink" (
    "id" TEXT NOT NULL,
    "emailTrackingId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "trackedLinkId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "firstMessageId" TEXT NOT NULL,
    "metadata" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "isFake" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sequenceId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "workDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "workHoursStart" TEXT NOT NULL DEFAULT '09:00',
    "workHoursEnd" TEXT NOT NULL DEFAULT '17:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'business',

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mailbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" INTEGER,
    "type" TEXT NOT NULL,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "providerAccountId" TEXT NOT NULL,

    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAlias" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceMailbox" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "aliasId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailWatchHistory" (
    "id" TEXT NOT NULL,
    "emailWatchId" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailWatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedMessage" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EmailListContacts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EmailListContacts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SequenceToLists" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SequenceToLists_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "SequenceStep_sequenceId_idx" ON "SequenceStep"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceContact_sequenceId_idx" ON "SequenceContact"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceContact_contactId_idx" ON "SequenceContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceContact_sequenceId_contactId_key" ON "SequenceContact"("sequenceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceStats_sequenceId_key" ON "SequenceStats"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceStats_sequenceId_idx" ON "SequenceStats"("sequenceId");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceHealth_sequenceId_key" ON "SequenceHealth"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceHealth_sequenceId_idx" ON "SequenceHealth"("sequenceId");

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

-- CreateIndex
CREATE INDEX "EmailTracking_sequenceId_idx" ON "EmailTracking"("sequenceId");

-- CreateIndex
CREATE INDEX "EmailTracking_userId_idx" ON "EmailTracking"("userId");

-- CreateIndex
CREATE INDEX "EmailTracking_contactId_idx" ON "EmailTracking"("contactId");

-- CreateIndex
CREATE INDEX "EmailEvent_trackingId_idx" ON "EmailEvent"("trackingId");

-- CreateIndex
CREATE INDEX "EmailEvent_type_idx" ON "EmailEvent"("type");

-- CreateIndex
CREATE INDEX "EmailEvent_timestamp_idx" ON "EmailEvent"("timestamp");

-- CreateIndex
CREATE INDEX "TrackedLink_emailTrackingId_idx" ON "TrackedLink"("emailTrackingId");

-- CreateIndex
CREATE INDEX "LinkClick_trackedLinkId_idx" ON "LinkClick"("trackedLinkId");

-- CreateIndex
CREATE INDEX "LinkClick_timestamp_idx" ON "LinkClick"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_threadId_key" ON "EmailThread"("threadId");

-- CreateIndex
CREATE INDEX "EmailThread_threadId_idx" ON "EmailThread"("threadId");

-- CreateIndex
CREATE INDEX "EmailThread_sequenceId_idx" ON "EmailThread"("sequenceId");

-- CreateIndex
CREATE INDEX "EmailThread_contactId_idx" ON "EmailThread"("contactId");

-- CreateIndex
CREATE INDEX "EmailThread_userId_idx" ON "EmailThread"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_sequenceId_key" ON "BusinessHours"("sequenceId");

-- CreateIndex
CREATE INDEX "BusinessHours_userId_idx" ON "BusinessHours"("userId");

-- CreateIndex
CREATE INDEX "BusinessHours_sequenceId_idx" ON "BusinessHours"("sequenceId");

-- CreateIndex
CREATE INDEX "BusinessHours_type_idx" ON "BusinessHours"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Mailbox_userId_email_key" ON "Mailbox"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAlias_mailboxId_alias_key" ON "EmailAlias"("mailboxId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceMailbox_sequenceId_key" ON "SequenceMailbox"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceMailbox_sequenceId_idx" ON "SequenceMailbox"("sequenceId");

-- CreateIndex
CREATE INDEX "SequenceMailbox_mailboxId_idx" ON "SequenceMailbox"("mailboxId");

-- CreateIndex
CREATE INDEX "SequenceMailbox_aliasId_idx" ON "SequenceMailbox"("aliasId");

-- CreateIndex
CREATE INDEX "SequenceMailbox_userId_idx" ON "SequenceMailbox"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailWatch_email_key" ON "EmailWatch"("email");

-- CreateIndex
CREATE INDEX "EmailWatch_userId_idx" ON "EmailWatch"("userId");

-- CreateIndex
CREATE INDEX "EmailWatchHistory_emailWatchId_idx" ON "EmailWatchHistory"("emailWatchId");

-- CreateIndex
CREATE INDEX "EmailWatchHistory_processed_idx" ON "EmailWatchHistory"("processed");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedMessage_messageId_key" ON "ProcessedMessage"("messageId");

-- CreateIndex
CREATE INDEX "ProcessedMessage_messageId_idx" ON "ProcessedMessage"("messageId");

-- CreateIndex
CREATE INDEX "ProcessedMessage_threadId_idx" ON "ProcessedMessage"("threadId");

-- CreateIndex
CREATE INDEX "ProcessedMessage_type_idx" ON "ProcessedMessage"("type");

-- CreateIndex
CREATE INDEX "_EmailListContacts_B_index" ON "_EmailListContacts"("B");

-- CreateIndex
CREATE INDEX "_SequenceToLists_B_index" ON "_SequenceToLists"("B");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_firstName_idx" ON "Contact"("firstName");

-- CreateIndex
CREATE INDEX "Contact_lastName_idx" ON "Contact"("lastName");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_email_key" ON "Contact"("userId", "email");

-- CreateIndex
CREATE INDEX "EmailList_userId_idx" ON "EmailList"("userId");

-- CreateIndex
CREATE INDEX "ListSyncRecord_listId_idx" ON "ListSyncRecord"("listId");

-- CreateIndex
CREATE INDEX "ListSyncRecord_sequenceId_idx" ON "ListSyncRecord"("sequenceId");

-- CreateIndex
CREATE INDEX "ListSyncRecord_status_idx" ON "ListSyncRecord"("status");

-- CreateIndex
CREATE INDEX "ListSyncRecord_createdAt_idx" ON "ListSyncRecord"("createdAt");

-- CreateIndex
CREATE INDEX "Sequence_userId_idx" ON "Sequence"("userId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceContact" ADD CONSTRAINT "SequenceContact_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceContact" ADD CONSTRAINT "SequenceContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStats" ADD CONSTRAINT "SequenceStats_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStats" ADD CONSTRAINT "SequenceStats_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceHealth" ADD CONSTRAINT "SequenceHealth_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTracking" ADD CONSTRAINT "EmailTracking_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTracking" ADD CONSTRAINT "EmailTracking_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTracking" ADD CONSTRAINT "EmailTracking_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "EmailTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedLink" ADD CONSTRAINT "TrackedLink_emailTrackingId_fkey" FOREIGN KEY ("emailTrackingId") REFERENCES "EmailTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_trackedLinkId_fkey" FOREIGN KEY ("trackedLinkId") REFERENCES "TrackedLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAlias" ADD CONSTRAINT "EmailAlias_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceMailbox" ADD CONSTRAINT "SequenceMailbox_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceMailbox" ADD CONSTRAINT "SequenceMailbox_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceMailbox" ADD CONSTRAINT "SequenceMailbox_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "EmailAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceMailbox" ADD CONSTRAINT "SequenceMailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailWatchHistory" ADD CONSTRAINT "EmailWatchHistory_emailWatchId_fkey" FOREIGN KEY ("emailWatchId") REFERENCES "EmailWatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmailListContacts" ADD CONSTRAINT "_EmailListContacts_A_fkey" FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmailListContacts" ADD CONSTRAINT "_EmailListContacts_B_fkey" FOREIGN KEY ("B") REFERENCES "EmailList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SequenceToLists" ADD CONSTRAINT "_SequenceToLists_A_fkey" FOREIGN KEY ("A") REFERENCES "EmailList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SequenceToLists" ADD CONSTRAINT "_SequenceToLists_B_fkey" FOREIGN KEY ("B") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
