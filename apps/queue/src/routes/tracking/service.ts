import { prisma } from "@mailjot/database";
import { logger } from "@/services/log/logger";
import type { EmailEventType } from "@mailjot/types";
import {
  updateSequenceStats,
  getSequenceStats,
} from "@/services/stats/sequence-stats-service";

export class TrackingService {
  async handleEmailOpen(hash: string): Promise<void> {
    try {
      const tracking = await prisma.emailTracking.findUnique({
        where: { hash },
        include: {
          events: {
            where: {
              type: "opened",
            },
          },
        },
      });

      if (!tracking) {
        logger.warn(`No tracking record found for hash: ${hash}`);
        return;
      }

      const isFirstOpen = tracking.events.length === 0;

      // Always increment the open count and update timestamps
      await prisma.emailTracking.update({
        where: { hash },
        data: {
          openCount: {
            increment: 1,
          },
          openedAt: tracking.openedAt ?? new Date(), // Only set openedAt if it hasn't been set before
          status: "opened",
          events: {
            create: {
              type: "opened",
              sequenceId: tracking.sequenceId,
              contactId: tracking.contactId,
              metadata: {
                openCount: tracking.openCount + 1,
                isFirstOpen,
              },
            },
          },
        },
      });

      // Update sequence stats if this is a sequence email
      if (tracking.sequenceId && tracking.contactId) {
        await updateSequenceStats(
          tracking.sequenceId,
          "opened",
          tracking.contactId,
          { isUniqueOpen: isFirstOpen }
        );
      }

      logger.info(
        `Recorded email open for hash: ${hash}, isFirstOpen: ${isFirstOpen}`
      );
    } catch (error) {
      logger.error("Error handling email open:", error);
      throw error;
    }
  }

  async handleLinkClick(hash: string, linkId: string): Promise<string> {
    try {
      const tracking = await prisma.emailTracking.findUnique({
        where: { hash },
        include: {
          links: {
            where: {
              id: linkId,
            },
          },
        },
      });

      if (!tracking) {
        logger.warn(`No tracking record found for hash: ${hash}`);
        throw new Error("Invalid tracking data");
      }

      const link = tracking.links[0];
      if (!link) {
        logger.warn(`No link found for id: ${linkId}`);
        throw new Error("Invalid link data");
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

        // Increment click count and update tracking
        await prisma.trackedLink.update({
          where: { id: linkId },
          data: {
            clickCount: {
              increment: 1,
            },
            updatedAt: new Date(),
          },
        });

        // Update tracking record
        await prisma.emailTracking.update({
          where: { id: tracking.id },
          data: {
            clickedAt: tracking.clickedAt ?? new Date(), // Only set clickedAt if it hasn't been set before
            status: "clicked",
            events: {
              create: {
                type: "clicked",
                timestamp: new Date(),
                metadata: {
                  linkId: linkId,
                  originalUrl: link.originalUrl,
                },
              },
            },
          },
        });
      });

      // Update sequence stats
      if (tracking.sequenceId && tracking.contactId) {
        await updateSequenceStats(
          tracking.sequenceId,
          "clicked",
          tracking.contactId
        );
      }

      logger.info(`Recorded link click for hash: ${hash}, linkId: ${linkId}`);
      return link.originalUrl;
    } catch (error) {
      logger.error("Error handling link click:", error);
      throw error;
    }
  }

  async trackEmailEvent(data: {
    trackingId: string;
    eventType: EmailEventType;
    metadata?: any;
  }): Promise<void> {
    try {
      const { trackingId, eventType, metadata } = data;

      const tracking = await prisma.emailTracking.findUnique({
        where: { id: trackingId },
      });

      if (!tracking) {
        throw new Error("Email tracking record not found");
      }

      // Create the event
      await prisma.emailEvent.create({
        data: {
          trackingId: tracking.id,
          type: eventType,
          metadata: metadata || {},
          timestamp: new Date(),
        },
      });

      // Update tracking status
      await prisma.emailTracking.update({
        where: { id: tracking.id },
        data: {
          status: eventType,
        },
      });

      // Update sequence stats if applicable
      if (tracking.sequenceId && tracking.contactId) {
        await updateSequenceStats(
          tracking.sequenceId,
          eventType,
          tracking.contactId
        );
      }

      logger.info(`Tracked email event: ${eventType} for email: ${trackingId}`);
    } catch (error) {
      logger.error("Error tracking email event:", error);
      throw error;
    }
  }
}
