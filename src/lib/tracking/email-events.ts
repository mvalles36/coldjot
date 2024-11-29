import { prisma } from "@/lib/prisma";
import type { EmailEventType, Prisma } from "@prisma/client";
import type { EmailTrackingMetadata } from "@/types/sequences";

export interface EventMetadata {
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  deviceType?: string;
  replyMessageId?: string;
  bounceReason?: string;
  threadId?: string;
  messageId?: string;
  from?: string;
  snippet?: string;
  timestamp?: string;
}

export async function trackEmailEvent(
  emailId: string,
  type: EmailEventType,
  metadata?: EventMetadata,
  trackingData?: EmailTrackingMetadata
) {
  try {
    const event = await prisma.emailEvent.create({
      data: {
        emailId,
        type,
        metadata: metadata as Prisma.JsonObject,
        sequenceId: trackingData?.sequenceId || "",
        contactId: trackingData?.contactId || "",
      },
    });

    console.log(`📊 Tracked email event:`, {
      emailId,
      type,
      eventId: event.id,
    });

    return event;
  } catch (error) {
    console.error(`❌ Failed to track email event:`, error);
    throw error;
  }
}

export async function getEmailEvents(emailId: string) {
  return await prisma.emailEvent.findMany({
    where: { emailId },
    orderBy: { timestamp: "desc" },
  });
}

export async function getSequenceEvents(
  sequenceId: string,
  timeframe?: { start: Date; end: Date }
) {
  const where = {
    sequenceId,
    ...(timeframe && {
      timestamp: {
        gte: timeframe.start,
        lte: timeframe.end,
      },
    }),
  };

  return await prisma.emailEvent.findMany({
    where,
    orderBy: { timestamp: "desc" },
    include: {
      contact: true,
    },
  });
}
