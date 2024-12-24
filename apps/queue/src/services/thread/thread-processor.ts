import { prisma } from "@mailjot/database";
import { google } from "googleapis";
import { DateTime } from "luxon";
import {
  extractEmailFromHeader,
  isBounceMessage,
  isSenderSequenceOwner,
  shouldProcessMessage,
} from "@/utils";

import { refreshAccessToken, oauth2Client } from "@/services/google";
import type { gmail_v1 } from "googleapis";
import type { MessagePartHeader } from "@mailjot/types";
import { MONITOR_CONFIG } from "@/config/constants";
import { GmailClientService } from "@/services/google";

type Gmail = gmail_v1.Gmail;
import type { ThreadCheckData, ThreadMetadata } from "@mailjot/types";
import { QueueService } from "@/services/queue/queue-service";

// Use monitor config constants
const { CHECK_FREQUENCIES, AGE_THRESHOLDS } = MONITOR_CONFIG.THREAD;

export class EmailThreadProcessor {
  private static instance: EmailThreadProcessor | null = null;

  private constructor() {}

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------
  public static getInstance(): EmailThreadProcessor {
    if (!EmailThreadProcessor.instance) {
      EmailThreadProcessor.instance = new EmailThreadProcessor();
    }
    return EmailThreadProcessor.instance;
  }

  // TODO : Add back the close method for cleanup
  public async close(): Promise<void> {
    // No need to close anything since we don't own the queue
    // But keep the method for interface compatibility
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  // Remove close method since we don't own the queue
  public async processThread(data: ThreadCheckData) {
    try {
      const { userId, threadId } = data;

      if (!userId || !threadId) {
        console.error("Invalid data for thread processing:", data);
        return;
      }

      console.log("Processing thread:", data);

      // Fetch and process thread messages
      await this.checkThreadForRepliesAndBounces(data);

      // Schedule next check based on thread age and activity
      await this.scheduleNextCheck(data);
    } catch (error) {
      console.error("Error processing thread:", error);
      throw error;
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private async checkThreadForRepliesAndBounces(data: ThreadCheckData) {
    const gmail = await GmailClientService.getInstance().getClient(
      data.userId!
    );

    const thread = await gmail.users.threads.get({
      userId: "me",
      id: data.threadId,
    });

    if (!thread.data.messages) return;

    // Process each message in the thread
    for (const message of thread.data.messages) {
      if (!message.id) continue;

      const messageDetails = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "metadata",
        metadataHeaders: [
          "From",
          "To",
          "Subject",
          "References",
          "In-Reply-To",
          "Content-Type",
          "X-Failed-Recipients",
        ],
      });

      const headers = messageDetails.data.payload?.headers || [];
      const labelIds = messageDetails.data.labelIds || [];

      // Check for bounces
      if (isBounceMessage(headers, labelIds)) {
        await this.processBounce(data, message.id, headers);
      }

      // Check for replies
      if (shouldProcessMessage(labelIds)) {
        const fromHeader =
          headers.find((h: MessagePartHeader) => h.name === "From")?.value ||
          "";
        const senderEmail = extractEmailFromHeader(fromHeader);

        if (!isSenderSequenceOwner(senderEmail, data.userId)) {
          await this.processReply(data, message.id, fromHeader, messageDetails);
        }
      }
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private async processBounce(
    data: ThreadCheckData,
    messageId: string,
    headers: MessagePartHeader[]
  ) {
    const existingBounce = await prisma.emailEvent.findFirst({
      where: {
        sequenceId: data.sequenceId,
        contactId: data.contactId,
        type: "BOUNCED",
      },
    });

    if (!existingBounce) {
      // Generate a unique tracking ID for the bounce event
      const trackingId = `bounce_${data.sequenceId}_${data.contactId}_${Date.now()}`;

      await prisma.emailEvent.create({
        data: {
          type: "BOUNCED",
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          trackingId,
          metadata: {
            messageId,
            threadId: data.threadId,
            bounceReason: headers.find((h) => h.name === "X-Failed-Recipients")
              ?.value,
          },
        },
      });

      await prisma.sequenceContact.updateMany({
        where: {
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          status: {
            notIn: ["completed", "bounced", "opted_out"],
          },
        },
        data: {
          status: "bounced",
          updatedAt: new Date(),
        },
      });
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private async processReply(
    data: ThreadCheckData,
    messageId: string,
    fromHeader: string,
    messageDetails: any
  ) {
    const existingReply = await prisma.emailEvent.findFirst({
      where: {
        sequenceId: data.sequenceId,
        contactId: data.contactId,
        type: "replied",
      },
    });

    if (!existingReply) {
      // first find the tracking id of the reply
      const trackingId = await prisma.emailEvent.findFirst({
        where: {
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          type: "sent",
        },
      });

      if (!trackingId) {
        console.error("No tracking ID found for the reply event");
        return;
      }

      // Generate a unique tracking ID for the reply event
      // const trackingId = `reply_${data.sequenceId}_${data.contactId}_${Date.now()}`;

      await prisma.emailEvent.create({
        data: {
          type: "replied",
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          trackingId: trackingId?.trackingId,
          metadata: {
            messageId,
            threadId: data.threadId,
            from: fromHeader,
            snippet: messageDetails.data.snippet,
            timestamp: new Date().toISOString(),
          },
        },
      });

      await prisma.sequenceContact.updateMany({
        where: {
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          status: {
            notIn: ["completed", "replied", "opted_out"],
          },
        },
        data: {
          status: "replied",
          updatedAt: new Date(),
        },
      });
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private async scheduleNextCheck(data: ThreadCheckData) {
    const threadAge = DateTime.now().diff(
      DateTime.fromJSDate(data.createdAt),
      "days"
    ).days;
    let nextCheckDelay;

    // Determine check frequency based on thread age
    if (threadAge <= AGE_THRESHOLDS.RECENT.days) {
      nextCheckDelay = CHECK_FREQUENCIES.RECENT;
    } else if (threadAge <= AGE_THRESHOLDS.MEDIUM.days) {
      nextCheckDelay = CHECK_FREQUENCIES.MEDIUM;
    } else if (threadAge <= AGE_THRESHOLDS.OLD.days) {
      nextCheckDelay = CHECK_FREQUENCIES.OLD;
    } else {
      nextCheckDelay = CHECK_FREQUENCIES.VERY_OLD;
    }

    // Schedule next check using QueueService
    const queueService = QueueService.getInstance();
    await queueService.addThreadJob(
      data,
      1,
      this.calculateDelay(nextCheckDelay)
    );

    // Update thread metadata
    const currentThread = await prisma.emailThread.findUnique({
      where: { id: data.threadId },
      select: { metadata: true },
    });

    const currentMetadata = (currentThread?.metadata || {}) as ThreadMetadata;

    await prisma.emailThread.update({
      where: { threadId: data.threadId },
      data: {
        metadata: {
          ...currentMetadata,
          lastCheckedAt: new Date().toISOString(),
        },
      },
    });
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private calculateDelay(frequency: { hours?: number; days?: number }): number {
    const hours = frequency.hours || frequency.days! * 24;
    return hours * 60 * 60 * 1000; // Convert to milliseconds
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------
  // Method to initialize checks for all threads
  public async initializeThreadChecks() {
    const threads = await prisma.emailThread.findMany({
      select: {
        id: true,
        userId: true,
        sequenceId: true,
        contactId: true,
        createdAt: true,
        metadata: true,
        threadId: true,
      },
    });

    const queueService = QueueService.getInstance();
    for (const thread of threads) {
      const metadata = (thread.metadata || {}) as ThreadMetadata;
      const data: ThreadCheckData = {
        threadId: thread.threadId,
        userId: thread.userId,
        sequenceId: thread.sequenceId,
        contactId: thread.contactId,
        messageId: "", // Add required field
        createdAt: thread.createdAt,
      };
      await queueService.addThreadJob(data);
    }
  }
}

// Export singleton instance
export const threadProcessor = EmailThreadProcessor.getInstance();
