/*
  Warnings:

  - You are about to drop the column `email` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Contact` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `EmailList` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `EmailList` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `EmailList` table. All the data in the column will be lost.
  - You are about to drop the column `contactsAdded` on the `ListSyncRecord` table. All the data in the column will be lost.
  - You are about to drop the column `error` on the `ListSyncRecord` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ListSyncRecord` table. All the data in the column will be lost.
  - You are about to drop the column `accessLevel` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `disableSending` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `scheduleType` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `testEmails` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `testMode` on the `Sequence` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingCompleted` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingData` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `onboardingStep` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BusinessHours` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Draft` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailAlias` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailThread` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailTracking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailWatch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmailWatchHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LinkClick` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Mailbox` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProcessedMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SequenceContact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SequenceHealth` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SequenceMailbox` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SequenceStats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SequenceStep` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Template` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TrackedLink` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_EmailListContacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_SequenceToLists` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessHours" DROP CONSTRAINT "BusinessHours_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "BusinessHours" DROP CONSTRAINT "BusinessHours_userId_fkey";

-- DropForeignKey
ALTER TABLE "Draft" DROP CONSTRAINT "Draft_contactId_fkey";

-- DropForeignKey
ALTER TABLE "Draft" DROP CONSTRAINT "Draft_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Draft" DROP CONSTRAINT "Draft_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmailAlias" DROP CONSTRAINT "EmailAlias_mailboxId_fkey";

-- DropForeignKey
ALTER TABLE "EmailEvent" DROP CONSTRAINT "EmailEvent_contactId_fkey";

-- DropForeignKey
ALTER TABLE "EmailEvent" DROP CONSTRAINT "EmailEvent_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "EmailEvent" DROP CONSTRAINT "EmailEvent_trackingId_fkey";

-- DropForeignKey
ALTER TABLE "EmailThread" DROP CONSTRAINT "EmailThread_contactId_fkey";

-- DropForeignKey
ALTER TABLE "EmailThread" DROP CONSTRAINT "EmailThread_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "EmailThread" DROP CONSTRAINT "EmailThread_userId_fkey";

-- DropForeignKey
ALTER TABLE "EmailTracking" DROP CONSTRAINT "EmailTracking_contactId_fkey";

-- DropForeignKey
ALTER TABLE "EmailTracking" DROP CONSTRAINT "EmailTracking_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "EmailTracking" DROP CONSTRAINT "EmailTracking_templateId_fkey";

-- DropForeignKey
ALTER TABLE "EmailWatchHistory" DROP CONSTRAINT "EmailWatchHistory_emailWatchId_fkey";

-- DropForeignKey
ALTER TABLE "LinkClick" DROP CONSTRAINT "LinkClick_trackedLinkId_fkey";

-- DropForeignKey
ALTER TABLE "Mailbox" DROP CONSTRAINT "Mailbox_userId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceContact" DROP CONSTRAINT "SequenceContact_contactId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceContact" DROP CONSTRAINT "SequenceContact_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceHealth" DROP CONSTRAINT "SequenceHealth_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceMailbox" DROP CONSTRAINT "SequenceMailbox_aliasId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceMailbox" DROP CONSTRAINT "SequenceMailbox_mailboxId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceMailbox" DROP CONSTRAINT "SequenceMailbox_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceMailbox" DROP CONSTRAINT "SequenceMailbox_userId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceStats" DROP CONSTRAINT "SequenceStats_contactId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceStats" DROP CONSTRAINT "SequenceStats_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceStep" DROP CONSTRAINT "SequenceStep_sequenceId_fkey";

-- DropForeignKey
ALTER TABLE "SequenceStep" DROP CONSTRAINT "SequenceStep_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Template" DROP CONSTRAINT "Template_userId_fkey";

-- DropForeignKey
ALTER TABLE "TrackedLink" DROP CONSTRAINT "TrackedLink_emailTrackingId_fkey";

-- DropForeignKey
ALTER TABLE "_EmailListContacts" DROP CONSTRAINT "_EmailListContacts_A_fkey";

-- DropForeignKey
ALTER TABLE "_EmailListContacts" DROP CONSTRAINT "_EmailListContacts_B_fkey";

-- DropForeignKey
ALTER TABLE "_SequenceToLists" DROP CONSTRAINT "_SequenceToLists_A_fkey";

-- DropForeignKey
ALTER TABLE "_SequenceToLists" DROP CONSTRAINT "_SequenceToLists_B_fkey";

-- DropIndex
DROP INDEX "Contact_email_idx";

-- DropIndex
DROP INDEX "Contact_firstName_idx";

-- DropIndex
DROP INDEX "Contact_lastName_idx";

-- DropIndex
DROP INDEX "Contact_name_idx";

-- DropIndex
DROP INDEX "Contact_userId_email_key";

-- DropIndex
DROP INDEX "Contact_userId_idx";

-- DropIndex
DROP INDEX "EmailList_userId_idx";

-- DropIndex
DROP INDEX "ListSyncRecord_createdAt_idx";

-- DropIndex
DROP INDEX "ListSyncRecord_listId_idx";

-- DropIndex
DROP INDEX "ListSyncRecord_sequenceId_idx";

-- DropIndex
DROP INDEX "ListSyncRecord_status_idx";

-- DropIndex
DROP INDEX "Sequence_userId_idx";

-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "email",
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "EmailList" DROP COLUMN "description",
DROP COLUMN "name",
DROP COLUMN "tags";

-- AlterTable
ALTER TABLE "ListSyncRecord" DROP COLUMN "contactsAdded",
DROP COLUMN "error",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Sequence" DROP COLUMN "accessLevel",
DROP COLUMN "disableSending",
DROP COLUMN "metadata",
DROP COLUMN "name",
DROP COLUMN "scheduleType",
DROP COLUMN "status",
DROP COLUMN "testEmails",
DROP COLUMN "testMode";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified",
DROP COLUMN "image",
DROP COLUMN "onboardingCompleted",
DROP COLUMN "onboardingData",
DROP COLUMN "onboardingStep",
DROP COLUMN "role",
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "BusinessHours";

-- DropTable
DROP TABLE "Draft";

-- DropTable
DROP TABLE "EmailAlias";

-- DropTable
DROP TABLE "EmailEvent";

-- DropTable
DROP TABLE "EmailThread";

-- DropTable
DROP TABLE "EmailTracking";

-- DropTable
DROP TABLE "EmailWatch";

-- DropTable
DROP TABLE "EmailWatchHistory";

-- DropTable
DROP TABLE "LinkClick";

-- DropTable
DROP TABLE "Mailbox";

-- DropTable
DROP TABLE "ProcessedMessage";

-- DropTable
DROP TABLE "SequenceContact";

-- DropTable
DROP TABLE "SequenceHealth";

-- DropTable
DROP TABLE "SequenceMailbox";

-- DropTable
DROP TABLE "SequenceStats";

-- DropTable
DROP TABLE "SequenceStep";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "Template";

-- DropTable
DROP TABLE "TrackedLink";

-- DropTable
DROP TABLE "_EmailListContacts";

-- DropTable
DROP TABLE "_SequenceToLists";

-- CreateTable
CREATE TABLE "CallTracking" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallTracking_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CallTracking" ADD CONSTRAINT "CallTracking_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallTracking" ADD CONSTRAINT "CallTracking_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
