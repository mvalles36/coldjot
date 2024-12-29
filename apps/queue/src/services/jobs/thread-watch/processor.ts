import { Queue, Job } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { logger } from "@/lib/log";
import { prisma } from "@mailjot/database";
import {
  ThreadCheckData,
  ThreadMetadata,
  EmailEventEnum,
  SequenceContactStatusEnum,
} from "@mailjot/types";
import { MONITOR_CONFIG } from "@/config/monitor/constants";
import { GmailClientService } from "@/lib/google";
import { DateTime } from "luxon";
import {
  extractEmailFromHeader,
  isBounceMessage,
  isSenderSequenceOwner,
  shouldProcessMessage,
} from "@/utils";
import type { MessagePartHeader } from "@mailjot/types";
import { QueueService } from "@/services/queue/queue-service";
import { updateSequenceStats } from "@/lib/stats";
import { QUEUE_NAMES } from "@/config/queue/queue";

// Environment-specific configuration
type Environment = "DEVELOPMENT" | "DEMO" | "PRODUCTION";
const CURRENT_ENV = (process.env.NODE_ENV?.toUpperCase() ||
  "DEVELOPMENT") as Environment;
const IS_DEMO_MODE = process.env.DEMO_MODE === "true";

// Use monitor config constants
const { CHECK_FREQUENCIES, AGE_THRESHOLDS } = MONITOR_CONFIG.THREAD;

export class ThreadProcessor extends BaseProcessor<ThreadCheckData> {
  constructor(queue: Queue) {
    super(queue, QUEUE_NAMES.THREAD_WATCHER, {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000, // 1 second
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
  }

  protected async process(job: Job<ThreadCheckData>): Promise<void> {
    try {
      const { userId, threadId } = job.data;

      if (!userId || !threadId) {
        logger.error("Invalid data for thread processing:", job.data);
        return;
      }

      // Check if thread already has a bounce or reply
      const existingEvents = await prisma.emailEvent.findMany({
        where: {
          sequenceId: job.data.sequenceId,
          contactId: job.data.contactId,
          type: {
            in: [EmailEventEnum.BOUNCED, EmailEventEnum.REPLIED],
          },
        },
      });

      if (existingEvents.length > 0) {
        logger.info(
          `Thread ${threadId} already has ${existingEvents.map((e) => e.type).join(", ")} event(s). Stopping further checks.`
        );
        try {
          const queueService = QueueService.getInstance();
          await queueService.removeThreadJob(threadId);
        } catch (error: any) {
          logger.warn(
            `Failed to remove thread job, but continuing as thread has already been processed: ${error?.message || "Unknown error"}`
          );
        }
        return;
      }

      logger.info("Processing thread:", job.data);

      // Fetch and process thread messages
      const hasNewEvents = await this.checkThreadForRepliesAndBounces(job.data);

      // Only schedule next check if no bounce or reply was found
      if (!hasNewEvents) {
        await this.scheduleNextCheck(job.data);
      } else {
        try {
          const queueService = QueueService.getInstance();
          await queueService.removeThreadJob(threadId);
        } catch (error: any) {
          logger.warn(
            `Failed to remove thread job after finding events, but continuing: ${error?.message || "Unknown error"}`
          );
        }
      }
    } catch (error) {
      logger.error("Error processing thread:", error);
      // If there's an error, we might want to stop checking this thread
      if (this.shouldStopCheckingAfterError(error)) {
        try {
          const queueService = QueueService.getInstance();
          await queueService.removeThreadJob(job.data.threadId);
        } catch (error: any) {
          logger.warn(
            `Failed to remove thread job after error, but continuing: ${error?.message || "Unknown error"}`
          );
        }
      }
      throw error;
    }
  }

  private shouldStopCheckingAfterError(error: any): boolean {
    const permanentErrors = [
      "Invalid thread ID",
      "Thread not found",
      "Account not found",
      "Invalid credentials",
      "Account disconnected",
    ];

    if (error.message) {
      return permanentErrors.some((errMsg) => error.message.includes(errMsg));
    }

    return false;
  }

  private async checkThreadForRepliesAndBounces(
    data: ThreadCheckData
  ): Promise<boolean> {
    const gmail = await GmailClientService.getInstance().getClient(
      data.userId!
    );

    try {
      logger.info(
        `🔍 Fetching thread ${data.threadId} for user ${data.userId}`
      );

      const thread = await gmail.users.threads.get({
        userId: "me",
        id: data.threadId,
      });

      if (!thread.data.messages) {
        logger.warn(`⚠️ No messages found in thread ${data.threadId}`);
        return false;
      }

      logger.info(
        `📨 Found ${thread.data.messages.length} messages in thread ${data.threadId}`
      );
      let foundNewEvent = false;

      // Process each message in the thread
      for (const message of thread.data.messages) {
        if (!message.id) continue;

        logger.debug(
          `🔍 Checking message ${message.id} in thread ${data.threadId}`
        );

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
            "Message-ID",
            "Date",
          ],
        });

        const headers = messageDetails.data.payload?.headers || [];
        const labelIds = messageDetails.data.labelIds || [];

        logger.debug("📧 Message headers details");

        // Check for bounces
        const isBounce = isBounceMessage(headers);
        logger.debug(`🔍 Bounce check for message ${message.id}: ${isBounce}`);

        if (isBounce) {
          logger.info(`📭 Found bounce in message ${message.id}`);
          await this.processBounce(data, message.id, headers);
          foundNewEvent = true;
          break;
        }

        // Check for replies
        if (!isBounce && shouldProcessMessage(labelIds)) {
          const fromHeader =
            headers.find(
              (h: MessagePartHeader) => h.name?.toLowerCase() === "from"
            )?.value || "";
          const senderEmail = extractEmailFromHeader(fromHeader);

          logger.debug(
            {
              messageId: message.id,
              fromHeader,
              senderEmail,
              isOwner: isSenderSequenceOwner(senderEmail, data.userId),
            },
            "👤 Sender check"
          );

          if (!isSenderSequenceOwner(senderEmail, data.userId)) {
            logger.info(
              `💬 Found reply in message ${message.id} from ${senderEmail}`
            );
            await this.processReply(
              data,
              message.id,
              fromHeader,
              messageDetails
            );
            foundNewEvent = true;
            break;
          }
        }
      }

      logger.info(
        `✅ Finished checking thread ${data.threadId}, foundNewEvent: ${foundNewEvent}`
      );
      return foundNewEvent;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          threadId: data.threadId,
          userId: data.userId,
        },
        "❌ Error checking thread"
      );
      throw error;
    }
  }

  private async processBounce(
    data: ThreadCheckData,
    messageId: string,
    headers: MessagePartHeader[]
  ) {
    const existingBounce = await prisma.emailEvent.findFirst({
      where: {
        sequenceId: data.sequenceId,
        contactId: data.contactId,
        type: EmailEventEnum.BOUNCED,
      },
    });

    if (!existingBounce) {
      // first find the tracking id of the reply
      const trackingId = await prisma.emailEvent.findFirst({
        where: {
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          type: EmailEventEnum.SENT,
        },
      });

      if (!trackingId) {
        console.error("No tracking ID found for the bounce event");
        return;
      }

      await prisma.emailEvent.create({
        data: {
          type: EmailEventEnum.BOUNCED,
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
            notIn: [
              SequenceContactStatusEnum.COMPLETED,
              SequenceContactStatusEnum.BOUNCED,
              SequenceContactStatusEnum.OPTED_OUT,
            ],
          },
        },
        data: {
          status: SequenceContactStatusEnum.BOUNCED,
          updatedAt: new Date(),
        },
      });

      await updateSequenceStats(
        data.sequenceId,
        EmailEventEnum.BOUNCED,
        data.contactId
      );
    }
  }

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
        type: EmailEventEnum.REPLIED,
      },
    });

    if (!existingReply) {
      // first find the tracking id of the reply
      const trackingId = await prisma.emailEvent.findFirst({
        where: {
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          type: EmailEventEnum.SENT,
        },
      });

      if (!trackingId) {
        console.error("No tracking ID found for the reply event");
        return;
      }

      await prisma.emailEvent.create({
        data: {
          type: EmailEventEnum.REPLIED,
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

      await updateSequenceStats(
        data.sequenceId,
        EmailEventEnum.REPLIED,
        data.contactId
      );
    }
  }

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
}
