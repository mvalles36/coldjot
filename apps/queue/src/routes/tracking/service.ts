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

      // Update tracking event
      await prisma.emailTrackingEvent.update({
        where: { hash },
        data: { openCount: { increment: 1 } },
      });

      // Update sequence stats
      if (event.sequenceId && event.contactId) {
        await updateSequenceStats(event.sequenceId, "opened", event.contactId);
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
      });

      if (!link) {
        logger.warn(`No link found for id: ${linkId}`);
        throw new Error("Invalid link data");
      }

      // Update link click count
      await prisma.trackedLink.update({
        where: { id: linkId },
        data: {
          clickCount: { increment: 1 },
          clicks: {
            create: {
              timestamp: new Date(),
            },
          },
        },
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
