import { prisma } from "@mailjot/database";
import { BusinessHours, StepStatus } from "@mailjot/types";
import { GoogleAccount } from "@mailjot/types";
import { logger } from "../log/logger";

/**
 * Get user's Google account details
 */
export async function getUserGoogleAccount(
  userId: string
): Promise<GoogleAccount | null> {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      accounts: {
        where: {
          provider: "google",
        },
        select: {
          access_token: true,
          refresh_token: true,
          expires_at: true,
        },
        take: 1,
      },
    },
  });

  if (
    !account?.email ||
    !account.accounts[0]?.access_token ||
    !account.accounts[0]?.refresh_token
  ) {
    return null;
  }

  return {
    email: account.email,
    accessToken: account.accounts[0].access_token,
    refreshToken: account.accounts[0].refresh_token,
    expiryDate: account.accounts[0].expires_at || 0,
  };
}

/**
 * Get default business hours if not provided
 */
export function getDefaultBusinessHours(): BusinessHours {
  return {
    timezone: "UTC",
    workDays: [1, 2, 3, 4, 5],
    workHoursStart: "09:00",
    workHoursEnd: "17:00",
    holidays: [],
  };
}

/**
 * Update sequence contact status
 */
export async function updateSequenceContactStatus(
  contactId: string,
  status: StepStatus,
  completedAt?: Date
) {
  try {
    await prisma.sequenceContact.update({
      where: { id: contactId },
      data: {
        status,
        completedAt,
        lastProcessedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error(`Error updating sequence contact status: ${error}`);
    throw error;
  }
}

/**
 * Update sequence contact status
 */
export async function updateSequenceContactThreadId(
  contactId: string,
  sequenceId: string,
  threadId: string
) {
  try {
    await prisma.sequenceContact.update({
      where: { sequenceId_contactId: { sequenceId, contactId } },
      data: {
        threadId,
        lastProcessedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error(`Error updating sequence contact threadId: ${error}`);
    throw error;
  }
}

/**
 * Update sequence progress
 */
export async function updateSequenceContactProgress(
  sequenceId: string,
  contactId: string,
  currentStepIndex: number,
  nextScheduledAt: Date
) {
  try {
    await prisma.sequenceContactProgress.upsert({
      where: {
        sequenceId_contactId: {
          sequenceId,
          contactId,
        },
      },
      update: {
        currentStepIndex,
        lastProcessedAt: new Date(),
        nextScheduledAt,
      },
      create: {
        sequenceId,
        contactId,
        currentStepIndex,
        lastProcessedAt: new Date(),
        nextScheduledAt,
      },
    });
  } catch (error) {
    logger.error(`Error updating sequence progress: ${error}`);
    throw error;
  }
}

/**
 * Get active contacts for sequence
 */
export async function getActiveSequenceContacts(sequenceId: string) {
  return prisma.sequenceContact.findMany({
    where: {
      sequenceId,
      status: {
        notIn: ["completed", "opted_out"],
      },
    },
    include: {
      contact: true,
    },
  });
}

/**
 * Get sequence with steps and business hours
 */
export async function getSequenceWithDetails(sequenceId: string) {
  return prisma.sequence.findUnique({
    where: { id: sequenceId },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
      businessHours: true,
    },
  });
}

/**
 * Get contact's current progress in sequence
 */
export async function getContactProgress(
  sequenceId: string,
  contactId: string
) {
  return prisma.sequenceContactProgress.findFirst({
    where: {
      sequenceId,
      contactId,
    },
  });
}

/**
 * Reset sequence state completely
 */
export async function resetSequence(sequenceId: string): Promise<void> {
  logger.info(`🔄 Resetting sequence: ${sequenceId}`);

  try {
    // Delete all email tracking records
    await prisma.emailTracking.deleteMany({
      where: {
        metadata: {
          path: ["sequenceId"],
          equals: sequenceId,
        },
      },
    });
    logger.info(`✓ Email tracking records deleted`);

    // Delete all email events
    await prisma.emailEvent.deleteMany({
      where: {
        sequenceId,
      },
    });
    logger.info(`✓ Email events deleted`);

    // Delete all step statuses
    await prisma.stepStatus.deleteMany({
      where: {
        sequenceId,
      },
    });
    logger.info(`✓ Step statuses deleted`);

    // Delete sequence progress
    await prisma.sequenceContactProgress.deleteMany({
      where: {
        sequenceId,
      },
    });
    logger.info(`✓ Sequence progress deleted`);

    // Reset sequence contacts status
    await prisma.sequenceContact.updateMany({
      where: {
        sequenceId,
      },
      data: {
        status: "pending",
        lastProcessedAt: null,
        completedAt: null,
        threadId: null,
      },
    });
    logger.info(`✓ Sequence contacts reset`);

    // Reset sequence stats
    await prisma.sequenceStats.deleteMany({
      where: {
        sequenceId,
      },
    });
    logger.info(`✓ Sequence stats reset`);

    // Reset sequence health
    await prisma.sequenceHealth.deleteMany({
      where: {
        sequenceId,
      },
    });
    logger.info(`✓ Sequence health reset`);

    // Reset rate limits in Redis
    // Note: This will be handled by the rate limiter service

    logger.info(`✨ Sequence reset completed: ${sequenceId}`);
  } catch (error) {
    logger.error(`Error resetting sequence: ${error}`);
    throw error;
  }
}
