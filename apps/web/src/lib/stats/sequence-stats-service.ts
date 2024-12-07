import { prisma } from "@mailjot/database";
import { EmailEventType } from "@/types";
import type { Prisma } from "@prisma/client";

/**
 * Calculate rates based on current stats
 */
const calculateRates = (stats: {
  sentEmails: number;
  openedEmails: number;
  uniqueOpens: number;
  clickedEmails: number;
  repliedEmails: number;
  bouncedEmails: number;
}) => {
  const denominator = Math.max(stats.sentEmails, 1); // Prevent division by zero
  return {
    openRate: (stats.uniqueOpens / denominator) * 100, // Use unique opens for open rate
    clickRate: (stats.clickedEmails / denominator) * 100,
    replyRate: (stats.repliedEmails / denominator) * 100,
    bounceRate: (stats.bouncedEmails / denominator) * 100,
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
    let stats = await tx.sequenceStats.findUnique({
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
            updates.peopleContacted = stats.peopleContacted + 1;
          }
        }

        updates.totalEmails = stats.totalEmails + 1;
        updates.sentEmails = stats.sentEmails + 1;

        // Recalculate rates with new sent count
        const newRates = calculateRates({
          ...stats,
          sentEmails: stats.sentEmails + 1,
        });
        Object.assign(updates, newRates);
        break;
      }

      case "opened": {
        // Always increment total opens
        updates.openedEmails = stats.openedEmails + 1;

        // Check for unique opens only if we have a contactId
        if (contactId) {
          // Get all previous opens for this contact
          const existingOpens = await tx.emailEvent.findFirst({
            where: {
              sequenceId,
              contactId,
              type: "opened",
            },
          });

          // If this is the first open by this contact
          if (!existingOpens) {
            updates.uniqueOpens = stats.uniqueOpens + 1;

            // Recalculate open rate based on unique opens
            const newRates = calculateRates({
              ...stats,
              uniqueOpens: stats.uniqueOpens + 1,
            });
            updates.openRate = newRates.openRate;
          }

          // Log the open event for tracking
          await tx.emailEvent.create({
            data: {
              type: "opened",
              sequenceId,
              contactId,
              emailId: "", // You might want to pass this as a parameter
              metadata: {
                timestamp: new Date(),
                isUnique: !existingOpens,
              },
            },
          });
        }
        break;
      }

      case "clicked": {
        updates.clickedEmails = stats.clickedEmails + 1;
        updates.clickRate =
          ((stats.clickedEmails + 1) / Math.max(stats.sentEmails, 1)) * 100;
        break;
      }

      case "replied": {
        updates.repliedEmails = stats.repliedEmails + 1;
        updates.replyRate =
          ((stats.repliedEmails + 1) / Math.max(stats.sentEmails, 1)) * 100;
        break;
      }

      case "bounced": {
        updates.bouncedEmails = stats.bouncedEmails + 1;
        updates.bounceRate =
          ((stats.bouncedEmails + 1) / Math.max(stats.sentEmails, 1)) * 100;
        break;
      }

      case "unsubscribed": {
        // Only count unique unsubscribes
        if (contactId) {
          const existingUnsubscribes = await getExistingEventCount({
            sequenceId,
            contactId,
            type: "unsubscribed",
          });

          if (existingUnsubscribes === 0) {
            updates.unsubscribed = stats.unsubscribed + 1;
          }
        }
        break;
      }

      case "interested": {
        // Only count unique interests
        if (contactId) {
          const existingInterests = await getExistingEventCount({
            sequenceId,
            contactId,
            type: "interested",
          });

          if (existingInterests === 0) {
            updates.interested = stats.interested + 1;
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
  const stats = await prisma.sequenceStats.findUnique({
    where: { sequenceId },
  });

  if (!stats) {
    const defaultStats: Prisma.SequenceStatsGetPayload<{}> = {
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
      unsubscribed: 0,
      interested: 0,
      peopleContacted: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      bounceRate: 0,
      avgResponseTime: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return defaultStats;
  }

  return stats;
};
