import { prisma } from "@mailjot/database";
import type { EmailEventType } from "@mailjot/types";
import type { Prisma } from "@prisma/client";

/**
 * Calculate rates based on current stats
 */
const calculateRates = (stats: {
  sentEmails: number | null;
  openedEmails: number | null;
  uniqueOpens: number | null;
  clickedEmails: number | null;
  repliedEmails: number | null;
  bouncedEmails: number | null;
}) => {
  const denominator = Math.max(stats.sentEmails ?? 0, 1); // Prevent division by zero
  return {
    openRate: ((stats.uniqueOpens ?? 0) / denominator) * 100, // Use unique opens for open rate
    clickRate: ((stats.clickedEmails ?? 0) / denominator) * 100,
    replyRate: ((stats.repliedEmails ?? 0) / denominator) * 100,
    bounceRate: ((stats.bouncedEmails ?? 0) / denominator) * 100,
  };
};

/**
 * Get existing event count for a specific type and contact
 */
const getExistingEventCount = async (params: {
  sequenceId: string;
  contactId: string;
  type: EmailEventType;
}) => {
  const count = await prisma.emailEvent.count({
    where: {
      sequenceId: params.sequenceId,
      contactId: params.contactId,
      type: params.type,
    },
  });
  return count;
};

/**
 * Update sequence stats with atomic operations
 */
export const updateSequenceStats = async (
  sequenceId: string,
  type: EmailEventType,
  contactId?: string
) => {
  // Start a transaction to ensure data consistency
  return prisma.$transaction(async (tx) => {
    // Get or create stats
    let stats = await tx.sequenceStats.findFirst({
      where: { sequenceId },
    });

    if (!stats) {
      stats = await tx.sequenceStats.create({
        data: {
          sequence: {
            connect: { id: sequenceId },
          },
          totalEmails: 0,
          sentEmails: 0,
          openedEmails: 0,
          uniqueOpens: 0,
          clickedEmails: 0,
          repliedEmails: 0,
          bouncedEmails: 0,
          failedEmails: 0,
          unsubscribed: 0,
          interested: 0,
          peopleContacted: 0,
          openRate: 0,
          clickRate: 0,
          replyRate: 0,
          bounceRate: 0,
        },
      });
    }

    // Initialize updates object
    const updates: Prisma.SequenceStatsUpdateInput = {};

    // Handle different event types
    switch (type) {
      case "sent": {
        // Check if this is a new contact
        if (contactId) {
          const existingSends = await getExistingEventCount({
            sequenceId,
            contactId,
            type: "sent",
          });

          if (existingSends === 0) {
            updates.peopleContacted = { increment: 1 };
          }
        }

        updates.totalEmails = { increment: 1 };
        updates.sentEmails = { increment: 1 };

        // Recalculate rates with new sent count
        const newRates = calculateRates({
          ...stats,
          sentEmails: (stats.sentEmails ?? 0) + 1,
          openedEmails: stats.openedEmails ?? 0,
          uniqueOpens: stats.uniqueOpens ?? 0,
          clickedEmails: stats.clickedEmails ?? 0,
          repliedEmails: stats.repliedEmails ?? 0,
          bouncedEmails: stats.bouncedEmails ?? 0,
        });
        Object.assign(updates, {
          openRate: newRates.openRate,
          clickRate: newRates.clickRate,
          replyRate: newRates.replyRate,
          bounceRate: newRates.bounceRate,
        });
        break;
      }

      case "opened": {
        updates.openedEmails = { increment: 1 };

        if (contactId) {
          const existingOpens = await tx.emailEvent.findFirst({
            where: {
              sequenceId,
              contactId,
              type: "opened",
            },
          });

          if (!existingOpens) {
            updates.uniqueOpens = { increment: 1 };
            const newRates = calculateRates({
              ...stats,
              sentEmails: stats.sentEmails ?? 0,
              openedEmails: stats.openedEmails ?? 0,
              uniqueOpens: (stats.uniqueOpens ?? 0) + 1,
              clickedEmails: stats.clickedEmails ?? 0,
              repliedEmails: stats.repliedEmails ?? 0,
              bouncedEmails: stats.bouncedEmails ?? 0,
            });
            updates.openRate = newRates.openRate;
          }
        }
        break;
      }

      case "clicked": {
        updates.clickedEmails = { increment: 1 };
        const newRates = calculateRates({
          ...stats,
          sentEmails: stats.sentEmails ?? 0,
          openedEmails: stats.openedEmails ?? 0,
          uniqueOpens: stats.uniqueOpens ?? 0,
          clickedEmails: (stats.clickedEmails ?? 0) + 1,
          repliedEmails: stats.repliedEmails ?? 0,
          bouncedEmails: stats.bouncedEmails ?? 0,
        });
        updates.clickRate = newRates.clickRate;
        break;
      }

      case "replied": {
        updates.repliedEmails = { increment: 1 };
        const newRates = calculateRates({
          ...stats,
          sentEmails: stats.sentEmails ?? 0,
          openedEmails: stats.openedEmails ?? 0,
          uniqueOpens: stats.uniqueOpens ?? 0,
          clickedEmails: stats.clickedEmails ?? 0,
          repliedEmails: (stats.repliedEmails ?? 0) + 1,
          bouncedEmails: stats.bouncedEmails ?? 0,
        });
        updates.replyRate = newRates.replyRate;
        break;
      }

      case "bounced": {
        updates.bouncedEmails = { increment: 1 };
        const newRates = calculateRates({
          ...stats,
          sentEmails: stats.sentEmails ?? 0,
          openedEmails: stats.openedEmails ?? 0,
          uniqueOpens: stats.uniqueOpens ?? 0,
          clickedEmails: stats.clickedEmails ?? 0,
          repliedEmails: stats.repliedEmails ?? 0,
          bouncedEmails: (stats.bouncedEmails ?? 0) + 1,
        });
        updates.bounceRate = newRates.bounceRate;
        break;
      }

      case "unsubscribed": {
        if (contactId) {
          const existingUnsubscribes = await getExistingEventCount({
            sequenceId,
            contactId,
            type: "unsubscribed",
          });

          if (existingUnsubscribes === 0) {
            updates.unsubscribed = { increment: 1 };
          }
        }
        break;
      }

      case "interested": {
        if (contactId) {
          const existingInterests = await getExistingEventCount({
            sequenceId,
            contactId,
            type: "interested",
          });

          if (existingInterests === 0) {
            updates.interested = { increment: 1 };
          }
        }
        break;
      }
    }

    // Update stats atomically
    return tx.sequenceStats.update({
      where: { sequenceId },
      data: updates,
    });
  });
};

/**
 * Get sequence stats with default values
 */
export const getSequenceStats = async (sequenceId: string) => {
  const stats = await prisma.sequenceStats.findFirst({
    where: { sequenceId },
  });

  if (!stats) {
    return {
      id: "",
      sequenceId,
      contactId: null,
      totalEmails: 0,
      sentEmails: 0,
      openedEmails: 0,
      uniqueOpens: 0,
      clickedEmails: 0,
      repliedEmails: 0,
      bouncedEmails: 0,
      failedEmails: 0,
      unsubscribed: 0,
      interested: 0,
      peopleContacted: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      bounceRate: 0,
      avgResponseTime: null,
      avgOpenTime: null,
      avgClickTime: null,
      avgReplyTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  return stats;
};
