import { prisma } from "@mailjot/database";
import { BusinessHours, StepStatus } from "@mailjot/types";
import { GoogleAccount } from "@/types/queue";
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
 * Update sequence progress
 */
export async function updateSequenceProgress(
  sequenceId: string,
  contactId: string,
  currentStepIndex: number,
  nextScheduledAt: Date
) {
  try {
    await prisma.sequenceProgress.upsert({
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
  return prisma.sequenceProgress.findFirst({
    where: {
      sequenceId,
      contactId,
    },
  });
}
