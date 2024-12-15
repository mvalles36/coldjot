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
      const event = await prisma.emailTrackingEvent.findUnique({
        where: { hash },
      });

      if (!event) {
        logger.warn(`No tracking event found for hash: ${hash}`);
        return;
      }

      // Check for existing open event
      const existingOpenEvent = await prisma.emailEvent.findFirst({
        where: {
          emailId: event.id,
          type: "opened",
          sequenceId: event.sequenceId,
        },
      });

      // Always increment the open count on the tracking event
      await prisma.emailTrackingEvent.update({
        where: { hash },
        data: {
          type: "opened",
          openCount: {
            increment: 1,
          },
          timestamp: new Date(),
        },
      });

      // Update sequence stats
      if (event.sequenceId && event.contactId) {
        await updateSequenceStats(event.sequenceId, "opened", event.contactId);
      }

      // Only update stats if this is the first open for this email
      const isFirstOpen = !existingOpenEvent;

      if (isFirstOpen) {
        await prisma.emailEvent.create({
          data: {
            emailId: event.id,
            type: "opened",
            sequenceId: event.sequenceId,
            contactId: event.contactId,
          },
        });
      }

      logger.info(`Recorded email open for hash: ${hash}`);
    } catch (error) {
      logger.error("Error handling email open:", error);
      throw error;
    }
  }

  async handleLinkClick(hash: string, linkId: string): Promise<string> {
    try {
      // First get the tracking event
      const event = await prisma.emailTrackingEvent.findUnique({
        where: { hash },
      });

      if (!event) {
        logger.warn(`No tracking event found for hash: ${hash}`);
        throw new Error("Invalid tracking data");
      }

      // Then get the tracked link
      const link = await prisma.trackedLink.findUnique({
        where: { id: linkId },
        include: {
          // TODO: fix this as this is emailTrackingEvent not emailTracking
          // We are already getting the emailTrackingEvent at the top
          // emailTracking: true,
        },
      });

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

      // Update sequence stats
      if (event.sequenceId && event.contactId) {
        await updateSequenceStats(event.sequenceId, "clicked", event.contactId);
      }

      logger.info(`Recorded link click for hash: ${hash}, linkId: ${linkId}`);
      return link.originalUrl;
    } catch (error) {
      logger.error("Error handling link click:", error);
      throw error;
    }
  }

  async trackEmailEvent(data: {
    emailId: string;
    eventType: EmailEventType;
    metadata?: any;
  }): Promise<void> {
    try {
      const { emailId, eventType, metadata } = data;

      // TODO: This is a temporary solution to get the sequence ID from the email
      // Get the sequence ID from the email
      // const emailData = await prisma.email.findUnique({
      //   where: { id: emailId },
      //   select: {
      //     sequenceId: true,
      //     contactId: true,
      //   },
      // });

      // if (!emailData?.sequenceId) {
      //   throw new Error("Email or sequence not found");
      // }

      // // Record the event
      // await prisma.emailEvent.create({
      //   data: {
      //     type: eventType,
      //     metadata: metadata || {},
      //     timestamp: new Date(),
      //     sequenceId: emailData.sequenceId,
      //     emailId: emailId,
      //   },
      // });

      // // Update sequence stats if we have a contact
      // if (emailData.contactId) {
      //   await updateSequenceStats(
      //     emailData.sequenceId,
      //     eventType,
      //     emailData.contactId
      //   );
      // }

      logger.info(`Tracked email event: ${eventType} for email: ${emailId}`);
    } catch (error) {
      logger.error("Error tracking email event:", error);
      throw error;
    }
  }
}
