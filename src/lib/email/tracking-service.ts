import { prisma } from "@/lib/prisma";
import { EmailEventType } from "@/types";

export interface EmailEventMetadata {
  [key: string]: string | number | boolean | null | undefined;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  deviceType?: string;
  replyMessageId?: string;
  bounceReason?: string;
}

export const trackEmailEvent = async (
  emailId: string,
  sequenceId: string,
  type: EmailEventType,
  metadata?: EmailEventMetadata
) => {
  // Record the event
  await prisma.emailEvent.create({
    data: {
      emailId,
      type,
      sequenceId,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    },
  });

  // Update sequence stats
  const stats = await prisma.sequenceStats.findUnique({
    where: { sequenceId },
  });

  if (!stats) {
    // Create initial stats if they don't exist
    await prisma.sequenceStats.create({
      data: {
        sequenceId,
        totalEmails: type === "sent" ? 1 : 0,
        sentEmails: type === "sent" ? 1 : 0,
        openedEmails: type === "opened" ? 1 : 0,
        clickedEmails: type === "clicked" ? 1 : 0,
        repliedEmails: type === "replied" ? 1 : 0,
        bouncedEmails: type === "bounced" ? 1 : 0,
      },
    });
    return;
  }

  // Update existing stats
  const updates: any = {
    totalEmails: type === "sent" ? stats.totalEmails + 1 : stats.totalEmails,
  };

  switch (type) {
    case "sent":
      updates.sentEmails = stats.sentEmails + 1;
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

  await prisma.sequenceStats.update({
    where: { sequenceId },
    data: updates,
  });
};
