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
import { updateSequenceStats } from "../stats/sequence-stats-service";

// Use monitor config constants
const { CHECK_FREQUENCIES, AGE_THRESHOLDS } = MONITOR_CONFIG.THREAD;

// Environment-specific configuration
type Environment = "DEVELOPMENT" | "DEMO" | "PRODUCTION";
const CURRENT_ENV = (process.env.NODE_ENV?.toUpperCase() ||
  "DEVELOPMENT") as Environment;
const IS_DEMO_MODE = process.env.DEMO_MODE === "true";

export class EmailThreadProcessor {
  private static instance: EmailThreadProcessor | null = null;

  private constructor() {
    const env = this.getEnvironmentConfig();
    console.log(`🔄 Initializing EmailThreadProcessor in ${env} environment`);
    if (IS_DEMO_MODE) {
      console.log("🚀 Running in DEMO mode with accelerated check frequencies");
    }
  }

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

    console.log("Thread data:", thread.data);

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

      if (isBounceMessage(headers)) {
        console.log("Bounce message check");
        console.log(headers);
        console.log(labelIds);
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
      // const trackingId = `bounce_${data.sequenceId}_${data.contactId}_${Date.now()}`;

      // first find the tracking id of the reply
      const trackingId = await prisma.emailEvent.findFirst({
        where: {
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          type: "sent",
        },
      });

      if (!trackingId) {
        console.error("No tracking ID found for the bounce event");
        return;
      }

      await prisma.emailEvent.create({
        data: {
          type: "BOUNCED",
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          trackingId: trackingId?.trackingId,
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

      // update

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

      // await prisma.sequenceContact.updateMany({
      //   where: {
      //     sequenceId: data.sequenceId,
      //     contactId: data.contactId,
      //     status: {
      //       notIn: ["completed", "replied", "opted_out"],
      //     },
      //   },
      //   data: {
      //     status: "replied",
      //     updatedAt: new Date(),
      //   },
      // });

      await updateSequenceStats(data.sequenceId, "replied", data.contactId);
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private getEnvironmentConfig(): Environment {
    if (IS_DEMO_MODE) return "DEMO";
    return CURRENT_ENV;
  }

  private calculateTimeInMilliseconds(time: {
    seconds?: number;
    minutes?: number;
    hours?: number;
    days?: number;
  }): number {
    const seconds = time.seconds || 0;
    const minutes = time.minutes || 0;
    const hours = time.hours || 0;
    const days = time.days || 0;

    return (
      seconds * 1000 +
      minutes * 60 * 1000 +
      hours * 60 * 60 * 1000 +
      days * 24 * 60 * 60 * 1000
    );
  }

  private getThreadAge(createdAt: Date): number {
    const env = this.getEnvironmentConfig();
    const now = DateTime.now();
    const created = DateTime.fromJSDate(createdAt);

    // For demo and development, use minutes instead of days
    if (env === "DEMO" || env === "DEVELOPMENT") {
      return now.diff(created, "minutes").minutes;
    }

    return now.diff(created, "days").days;
  }

  private getCheckFrequency(threadAge: number): {
    seconds?: number;
    minutes?: number;
    hours?: number;
    days?: number;
  } {
    const env = this.getEnvironmentConfig();
    const thresholds = AGE_THRESHOLDS[env];
    const frequencies = CHECK_FREQUENCIES[env];

    if (this.isRecentThread(threadAge, env)) {
      return frequencies.RECENT;
    } else if (this.isMediumAgedThread(threadAge, env)) {
      return frequencies.MEDIUM;
    } else if (this.isOldThread(threadAge, env)) {
      return frequencies.OLD;
    } else {
      return frequencies.VERY_OLD;
    }
  }

  private isRecentThread(age: number, env: Environment): boolean {
    const threshold = this.calculateTimeInMilliseconds(
      AGE_THRESHOLDS[env].RECENT
    );
    const ageInMs = this.calculateTimeInMilliseconds(
      env === "PRODUCTION" ? { days: age } : { minutes: age }
    );
    return ageInMs <= threshold;
  }

  private isMediumAgedThread(age: number, env: Environment): boolean {
    const threshold = this.calculateTimeInMilliseconds(
      AGE_THRESHOLDS[env].MEDIUM
    );
    const ageInMs = this.calculateTimeInMilliseconds(
      env === "PRODUCTION" ? { days: age } : { minutes: age }
    );
    return ageInMs <= threshold;
  }

  private isOldThread(age: number, env: Environment): boolean {
    const threshold = this.calculateTimeInMilliseconds(AGE_THRESHOLDS[env].OLD);
    const ageInMs = this.calculateTimeInMilliseconds(
      env === "PRODUCTION" ? { days: age } : { minutes: age }
    );
    return ageInMs <= threshold;
  }

  private async scheduleNextCheck(data: ThreadCheckData) {
    const threadAge = this.getThreadAge(data.createdAt);
    const nextCheckDelay = this.getCheckFrequency(threadAge);
    const delayMs = this.calculateTimeInMilliseconds(nextCheckDelay);
    const env = this.getEnvironmentConfig();

    console.log(`
🕒 Scheduling next thread check:
- Environment: ${env}
- Thread Age: ${threadAge} ${env === "PRODUCTION" ? "days" : "minutes"}
- Next Check Delay: ${JSON.stringify(nextCheckDelay)}
- Delay in MS: ${delayMs}
    `);

    // Schedule next check using QueueService
    const queueService = QueueService.getInstance();
    await queueService.addThreadJob(data, 1, delayMs);

    // Update thread metadata
    const currentThread = await prisma.emailThread.findUnique({
      where: { threadId: data.threadId },
      select: { metadata: true },
    });

    const currentMetadata = (currentThread?.metadata || {}) as ThreadMetadata;

    const nextCheckAt = new Date(Date.now() + delayMs);

    await prisma.emailThread.update({
      where: { threadId: data.threadId },
      data: {
        metadata: {
          ...currentMetadata,
          lastCheckedAt: new Date().toISOString(),
          nextCheckAt: nextCheckAt.toISOString(),
          environment: env,
          nextCheckDelay: nextCheckDelay,
          threadAge: threadAge,
          checkFrequency: {
            env,
            threadAge,
            nextCheckDelay,
            delayMs,
          },
        },
      },
    });
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
    const env = this.getEnvironmentConfig();

    console.log(
      `🔄 Initializing thread checks for ${threads.length} threads in ${env} environment`
    );

    for (const thread of threads) {
      const data: ThreadCheckData = {
        threadId: thread.threadId,
        userId: thread.userId,
        sequenceId: thread.sequenceId,
        contactId: thread.contactId,
        messageId: "", // Add required field
        createdAt: thread.createdAt,
      };

      // Calculate initial delay based on thread age
      const threadAge = this.getThreadAge(thread.createdAt);
      const nextCheckDelay = this.getCheckFrequency(threadAge);
      const delayMs = this.calculateTimeInMilliseconds(nextCheckDelay);

      // Add some jitter to prevent all threads from being checked at exactly the same time
      const jitter = Math.floor(Math.random() * 60000); // Random delay up to 1 minute
      const totalDelay = delayMs + jitter;

      console.log(`
📋 Scheduling initial check for thread:
- Thread ID: ${thread.threadId}
- Age: ${threadAge} ${env === "PRODUCTION" ? "days" : "minutes"}
- Base Delay: ${delayMs}ms
- Jitter: ${jitter}ms
- Total Delay: ${totalDelay}ms
      `);

      await queueService.addThreadJob(data, 1, totalDelay);
    }

    console.log(`✅ Initialized checks for ${threads.length} threads`);
  }
}

// Export singleton instance
export const threadProcessor = EmailThreadProcessor.getInstance();
