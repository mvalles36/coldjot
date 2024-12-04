import { prisma } from "@/lib/prisma";
import type { EmailEventType } from "@/lib/email/tracking-service";

export const updateSequenceStats = async (
  sequenceId: string,
  type: EmailEventType,
  contactId?: string
) => {
  const stats = await prisma.sequenceStats.findUnique({
    where: { sequenceId },
  });

  if (!stats) {
    // Create initial stats if they don't exist
    return prisma.sequenceStats.create({
      data: {
        sequenceId,
        totalEmails: type === "sent" ? 1 : 0,
        sentEmails: type === "sent" ? 1 : 0,
        openedEmails: type === "opened" ? 1 : 0,
        clickedEmails: type === "clicked" ? 1 : 0,
        repliedEmails: type === "replied" ? 1 : 0,
        bouncedEmails: type === "bounced" ? 1 : 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        bounceRate: 0,
        contactId,
      },
    });
  }

  // Calculate updates based on event type
  const updates: any = {
    totalEmails: type === "sent" ? stats.totalEmails + 1 : stats.totalEmails,
  };

  switch (type) {
    case "sent":
      updates.sentEmails = stats.sentEmails + 1;
      // Recalculate all rates
      updates.openRate = (stats.openedEmails / (stats.sentEmails + 1)) * 100;
      updates.clickRate = (stats.clickedEmails / (stats.sentEmails + 1)) * 100;
      updates.replyRate = (stats.repliedEmails / (stats.sentEmails + 1)) * 100;
      updates.bounceRate = (stats.bouncedEmails / (stats.sentEmails + 1)) * 100;
      break;

    case "opened":
      updates.openedEmails = stats.openedEmails + 1;
      updates.openRate = ((stats.openedEmails + 1) / stats.sentEmails) * 100;
      break;

    case "clicked":
      updates.clickedEmails = stats.clickedEmails + 1;
      updates.clickRate = ((stats.clickedEmails + 1) / stats.sentEmails) * 100;
      break;

    case "replied":
      updates.repliedEmails = stats.repliedEmails + 1;
      updates.replyRate = ((stats.repliedEmails + 1) / stats.sentEmails) * 100;
      break;

    case "bounced":
      updates.bouncedEmails = stats.bouncedEmails + 1;
      updates.bounceRate = ((stats.bouncedEmails + 1) / stats.sentEmails) * 100;
      break;
  }

  // Update stats
  return prisma.sequenceStats.update({
    where: { sequenceId },
    data: updates,
  });
};

export const getSequenceStats = async (sequenceId: string) => {
  const stats = await prisma.sequenceStats.findUnique({
    where: { sequenceId },
  });

  if (!stats) {
    return {
      totalEmails: 0,
      sentEmails: 0,
      openedEmails: 0,
      clickedEmails: 0,
      repliedEmails: 0,
      bouncedEmails: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      bounceRate: 0,
      avgResponseTime: null,
    };
  }

  return stats;
};
