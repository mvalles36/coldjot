import { EmailTrackingMetadata, EmailTracking } from "@mailjot/types";
import { nanoid } from "nanoid";
import { prisma } from "@mailjot/database";
import { getBaseUrl } from "@/utils";
import { updateSequenceStats } from "@/lib/stats/sequence-stats-service";
import type { Prisma } from "@prisma/client";
import { EmailEventType } from "@mailjot/types";

export async function createEmailTracking(
  metadata: EmailTrackingMetadata
): Promise<EmailTracking> {
  try {
    // Validate required fields
    const requiredFields = [
      "email",
      "userId",
      "sequenceId",
      "stepId",
      "contactId",
    ];
    const missingFields = requiredFields.filter(
      (field) => !metadata[field as keyof EmailTrackingMetadata]
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required metadata fields: ${missingFields.join(", ")}`
      );
    }

    const hash = await nanoid(48);

    const eventData = {
      hash,
      email: metadata.email,
      userId: metadata.userId,
      sequenceId: metadata.sequenceId,
      stepId: metadata.stepId,
      contactId: metadata.contactId,
      type: "CREATED",
      openCount: 0,
      timestamp: new Date(),
      createdAt: new Date(),
    };

    const trackingEvent = await prisma.emailTrackingEvent.create({
      data: eventData,
    });

    const tracking: EmailTracking = {
      id: trackingEvent.id,
      hash,
      metadata: { ...metadata, hash },
      type: "sequence",
      pixel: generateTrackingPixel(hash),
      wrappedLinks: true,
      trackingId: trackingEvent.id, // Add tracking ID for link association
    };

    return tracking;
  } catch (error) {
    console.error("Error creating email tracking:", error);
    throw new Error(
      `Failed to create email tracking: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function recordEmailOpen(hash: string): Promise<void> {
  try {
    const trackingEvent = await prisma.emailTrackingEvent.findUnique({
      where: { hash },
    });

    if (!trackingEvent) {
      throw new Error("No tracking event found");
    }

    // Check for existing open event
    const existingOpenEvent = await prisma.emailEvent.findFirst({
      where: {
        emailId: trackingEvent.id,
        type: "OPENED",
        sequenceId: trackingEvent.sequenceId,
      },
    });

    // Always increment the open count
    await prisma.emailTrackingEvent.update({
      where: { hash },
      data: {
        type: "OPENED",
        openCount: {
          increment: 1,
        },
        timestamp: new Date(),
      },
    });

    // Create an email event for this open
    await prisma.emailEvent.create({
      data: {
        emailId: trackingEvent.id,
        type: "OPENED",
        sequenceId: trackingEvent.sequenceId,
        contactId: trackingEvent.contactId,
      },
    });

    // Update sequence stats - this will handle both total opens and unique opens
    await updateSequenceStats(
      trackingEvent.sequenceId,
      "opened",
      trackingEvent.contactId
    );
  } catch (error) {
    console.error("Error recording email open:", error);
    throw error;
  }
}

export async function recordLinkClick(linkId: string): Promise<void> {
  try {
    const trackedLink = await prisma.trackedLink.findUnique({
      where: { id: linkId },
      include: {
        emailTracking: true,
      },
    });

    if (!trackedLink || !trackedLink.emailTracking) {
      throw new Error("No tracked link found");
    }

    // Create click record and update click count in a transaction
    await prisma.$transaction(async (prisma) => {
      // Create click record
      await prisma.linkClick.create({
        data: {
          trackedLinkId: linkId,
          timestamp: new Date(),
        },
      });

      // Increment click count
      await prisma.trackedLink.update({
        where: { id: linkId },
        data: {
          clickCount: {
            increment: 1,
          },
          updatedAt: new Date(),
        },
      });
    });

    // Always update stats for clicks as we want to track all clicks
    await updateSequenceStats(
      trackedLink.emailTracking.sequenceId,
      "clicked",
      trackedLink.emailTracking.contactId
    );
  } catch (error) {
    console.error("Error recording link click:", error);
    throw error;
  }
}

export async function createTrackedLink(
  emailTrackingId: string,
  originalUrl: string
): Promise<string> {
  try {
    const trackedLink = await prisma.trackedLink.create({
      data: {
        emailTrackingId,
        originalUrl,
        clickCount: 0,
      },
    });
    return trackedLink.id;
  } catch (error) {
    console.error("Error creating tracked link:", error);
    throw new Error(
      `Failed to create tracked link: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function addTrackingToEmail(
  content: string,
  tracking: EmailTracking
): Promise<string> {
  try {
    if (!content || !tracking) {
      throw new Error("Content and tracking information are required");
    }

    let trackedContent = content;

    if (tracking.wrappedLinks) {
      trackedContent = await wrapLinksWithTracking(
        trackedContent,
        tracking.metadata.hash!,
        tracking.trackingId!
      );
    }

    // Add development tracking link
    if (process.env.NODE_ENV === "development") {
      const baseUrl = getBaseUrl();
      const trackingUrl = new URL(
        `${baseUrl}/api/track/${tracking.metadata.hash}`
      );
      const devTrackingInfo = `
        <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 12px;">
          <p><strong>Development Tracking Info:</strong></p>
          <p>Tracking Hash: ${tracking.metadata.hash}</p>
          <p>Tracking URL: ${trackingUrl.toString()}</p>
          <p>Email: ${tracking.metadata.email}</p>
          <p>Tracking ID: ${tracking.trackingId}</p>
        </div>
      `;
      trackedContent = devTrackingInfo + trackedContent;
    }

    trackedContent += tracking.pixel;

    return trackedContent;
  } catch (error) {
    console.error("Error adding tracking to email:", error);
    throw new Error(
      `Failed to add tracking to email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function generateTrackingPixel(hash: string): string {
  try {
    if (!hash) {
      throw new Error("Hash is required for tracking pixel generation");
    }

    const baseUrl = getBaseUrl();
    const trackingUrl = new URL(`${baseUrl}/api/track/${hash}.png`);
    return `<img src="${trackingUrl.toString()}" alt="" style="display:none" width="1" height="1" />`;
  } catch (error) {
    console.error("Error generating tracking pixel:", error);
    throw new Error(
      `Failed to generate tracking pixel: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function wrapLinksWithTracking(
  content: string,
  hash: string,
  trackingId: string
): Promise<string> {
  try {
    if (!content || !hash || !trackingId) {
      throw new Error(
        "Content, hash, and tracking ID are required for link tracking"
      );
    }

    const baseUrl = getBaseUrl();
    const trackingBaseUrl = `${baseUrl}/api/track/${hash}/click`;

    // Use async replace to handle link creation
    const promises: Promise<string>[] = [];
    const matches: { match: string; url: string }[] = [];

    // Find all links and store them
    content.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match, quote, url) => {
        if (url.trim()) {
          matches.push({ match, url });
        }
        return match;
      }
    );

    // Create tracked links for all URLs
    for (const { match, url } of matches) {
      const linkId = await createTrackedLink(trackingId, url);
      const trackingUrl = new URL(trackingBaseUrl);
      trackingUrl.searchParams.set("lid", linkId); // Use link ID instead of URL
      content = content.replace(match, `<a href="${trackingUrl.toString()}"`);
    }

    return content;
  } catch (error) {
    console.error("Error in link tracking:", error);
    throw new Error(
      `Failed to wrap links with tracking: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
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
      Contact: true,
    },
  });
}
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

/**
 * Track an email event and update sequence stats
 * @param emailId - The ID of the email being tracked
 * @param type - The type of event (sent, opened, clicked, etc.)
 * @param metadata - Additional metadata about the event
 * @param trackingData - Optional additional tracking data
 */
export async function trackEmailEvent(
  emailId: string,
  // sequenceId: string,
  type: EmailEventType,
  metadata?: EventMetadata,
  trackingData?: EmailTrackingMetadata
) {
  try {
    const sequenceId = trackingData?.sequenceId;

    if (!sequenceId) {
      throw new Error("Sequence ID is required for tracking");
    }

    // Check for existing event of this type for this email (except for clicks)
    if (type !== "clicked") {
      const existingEvent = await prisma.emailEvent.findFirst({
        where: {
          emailId,
          type,
          sequenceId,
        },
      });

      if (existingEvent) {
        console.log(`Event ${type} already recorded for email ${emailId}`);
        return existingEvent;
      }
    }

    // Create the event
    const event = await prisma.emailEvent.create({
      data: {
        emailId,
        type,
        sequenceId,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        contactId: trackingData?.contactId,
      },
    });

    // Update sequence stats
    const stats = await prisma.sequenceStats.findUnique({
      where: { sequenceId: trackingData?.sequenceId },
    });

    if (!stats) {
      // Create initial stats if they don't exist
      await prisma.sequenceStats.create({
        data: {
          sequenceId: sequenceId,
          totalEmails: type === "sent" ? 1 : 0,
          sentEmails: type === "sent" ? 1 : 0,
          openedEmails: type === "opened" ? 1 : 0,
          clickedEmails: type === "clicked" ? 1 : 0,
          repliedEmails: type === "replied" ? 1 : 0,
          bouncedEmails: type === "bounced" ? 1 : 0,
          contactId: trackingData?.contactId,
        },
      });
      return event;
    }

    // Calculate updates based on event type
    const updates: Partial<Prisma.SequenceStatsUpdateInput> = {
      totalEmails: type === "sent" ? stats.totalEmails + 1 : stats.totalEmails,
    };

    switch (type) {
      case "sent":
        updates.sentEmails = stats.sentEmails + 1;
        // Recalculate all rates
        updates.openRate = (stats.openedEmails / (stats.sentEmails + 1)) * 100;
        updates.clickRate =
          (stats.clickedEmails / (stats.sentEmails + 1)) * 100;
        updates.replyRate =
          (stats.repliedEmails / (stats.sentEmails + 1)) * 100;
        updates.bounceRate =
          (stats.bouncedEmails / (stats.sentEmails + 1)) * 100;
        break;

      case "opened":
        updates.openedEmails = stats.openedEmails + 1;
        updates.openRate = ((stats.openedEmails + 1) / stats.sentEmails) * 100;
        break;

      case "clicked":
        updates.clickedEmails = stats.clickedEmails + 1;
        updates.clickRate =
          ((stats.clickedEmails + 1) / stats.sentEmails) * 100;
        break;

      case "replied":
        updates.repliedEmails = stats.repliedEmails + 1;
        updates.replyRate =
          ((stats.repliedEmails + 1) / stats.sentEmails) * 100;
        break;

      case "bounced":
        updates.bouncedEmails = stats.bouncedEmails + 1;
        updates.bounceRate =
          ((stats.bouncedEmails + 1) / stats.sentEmails) * 100;
        break;
    }

    // Update stats
    await prisma.sequenceStats.update({
      where: { sequenceId },
      data: updates,
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
