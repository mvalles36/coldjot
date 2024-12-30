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
import { updateSequenceStats } from "@/lib/stats";
import { QUEUE_NAMES } from "@/config/queue/queue";
import { ServiceManager } from "@/services/service-manager";
import { Prisma } from "@prisma/client";

// Environment-specific configuration
type Environment = "DEVELOPMENT" | "DEMO" | "PRODUCTION";
const CURRENT_ENV = (process.env.NODE_ENV?.toUpperCase() ||
  "DEVELOPMENT") as Environment;
const IS_DEMO_MODE = process.env.DEMO_MODE === "true";

// Use monitor config constants
const { CHECK_FREQUENCIES, AGE_THRESHOLDS } = MONITOR_CONFIG.THREAD;

interface ThreadCheckJob {
  type: "CHECK_THREADS";
  batchSize?: number;
}

interface EmailEventMetadata {
  threadId?: string;
}

export class ThreadProcessor extends BaseProcessor<ThreadCheckJob> {
  private readonly SCHEDULER_ID = "thread-monitoring-scheduler";
  private readonly DEFAULT_BATCH_SIZE = 50;
  private readonly CHECK_INTERVAL: number;

  constructor(queue: Queue) {
    super(queue, QUEUE_NAMES.THREAD_WATCHER, {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000,
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });

    // Get check interval from config based on environment
    const env = IS_DEMO_MODE ? "DEMO" : CURRENT_ENV;
    const frequency = CHECK_FREQUENCIES[env].RECENT;

    // Calculate interval in milliseconds based on available frequency units
    if ("minutes" in frequency) {
      this.CHECK_INTERVAL = frequency.minutes * 60 * 1000;
    } else if ("hours" in frequency) {
      this.CHECK_INTERVAL = frequency.hours * 60 * 60 * 1000;
    } else {
      this.CHECK_INTERVAL = 60000; // Default to 1 minute
    }

    logger.info("🧵 Thread Monitoring Processor initialized", {
      checkInterval: this.CHECK_INTERVAL,
      batchSize: this.DEFAULT_BATCH_SIZE,
      environment: CURRENT_ENV,
    });

    this.setupThreadMonitoringScheduler();
  }

  /**
   * Set up the job scheduler for periodic thread monitoring
   */
  private async setupThreadMonitoringScheduler(): Promise<void> {
    try {
      await this.queue.upsertJobScheduler(
        this.SCHEDULER_ID,
        { every: this.CHECK_INTERVAL },
        {
          name: "check-threads",
          data: { type: "CHECK_THREADS", batchSize: this.DEFAULT_BATCH_SIZE },
          opts: {
            removeOnComplete: true,
            removeOnFail: true,
          },
        }
      );
      logger.info(
        `📅 Thread monitoring scheduler initialized with ${this.CHECK_INTERVAL}ms interval`
      );
    } catch (error) {
      logger.error("❌ Failed to setup thread monitoring scheduler:", error);
      throw error;
    }
  }

  protected async process(job: Job<ThreadCheckJob>): Promise<void> {
    try {
      await this.processThreadBatch(
        job.data.batchSize || this.DEFAULT_BATCH_SIZE
      );
    } catch (error) {
      logger.error(`Failed to process thread monitoring job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Process a batch of threads that need monitoring
   */
  private async processThreadBatch(batchSize: number): Promise<void> {
    try {
      logger.info("🔍 Checking for threads to monitor", {
        batchSize,
        timestamp: new Date().toISOString(),
      });

      // Get thread IDs from email events that indicate thread completion
      const completedThreadIds = await prisma.emailEvent
        .findMany({
          where: {
            type: {
              in: [EmailEventEnum.BOUNCED, EmailEventEnum.REPLIED],
            },
          },
          select: {
            metadata: true,
          },
        })
        .then((events) => {
          const threadIds: string[] = [];
          events.forEach((event) => {
            const metadata = event.metadata as EmailEventMetadata;
            if (metadata?.threadId) {
              threadIds.push(metadata.threadId);
            }
          });
          return threadIds;
        });

      // Find threads that need checking based on their age and last check time
      const threadsToCheck = await prisma.emailThread.findMany({
        where: {
          OR: [
            {
              metadata: {
                equals: Prisma.JsonNull,
              },
            },
            {
              metadata: {
                lt: new Date(
                  Date.now() - this.calculateNextCheckDelay()
                ).toISOString(),
              },
            },
          ],
          // Only check active threads (no bounce/reply)
          NOT:
            completedThreadIds.length > 0
              ? {
                  id: {
                    in: completedThreadIds,
                  },
                }
              : undefined,
        },
        take: batchSize,
        orderBy: {
          createdAt: "asc",
        },
        include: {
          sequence: {
            select: {
              userId: true,
            },
          },
        },
      });

      logger.info(`📨 Found ${threadsToCheck.length} threads to check`);

      // Process each thread
      for (const thread of threadsToCheck) {
        try {
          await this.checkThread(thread);
        } catch (error) {
          logger.error(`Error checking thread ${thread.threadId}:`, error);
          continue;
        }
      }

      logger.info("✅ Completed thread monitoring batch", {
        processedCount: threadsToCheck.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("❌ Error in processThreadBatch:", error);
      throw error;
    }
  }

  /**
   * Calculate the delay until next check based on environment and thread age
   */
  private calculateNextCheckDelay(): number {
    const env = IS_DEMO_MODE ? "DEMO" : CURRENT_ENV;
    const frequency = CHECK_FREQUENCIES[env].RECENT;

    if ("minutes" in frequency) {
      return frequency.minutes * 60 * 1000;
    } else if ("hours" in frequency) {
      return frequency.hours * 60 * 60 * 1000;
    }
    return 60000; // Default to 1 minute
  }

  /**
   * Check an individual thread for replies or bounces
   */
  private async checkThread(thread: any): Promise<void> {
    try {
      const threadAge = this.getThreadAge(thread.createdAt);
      const checkData: ThreadCheckData = {
        threadId: thread.threadId,
        userId: thread.sequence.userId,
        sequenceId: thread.sequenceId,
        contactId: thread.contactId,
        messageId: thread.messageId || "",
        createdAt: thread.createdAt,
      };

      // Check for replies and bounces
      const hasNewEvents =
        await this.checkThreadForRepliesAndBounces(checkData);

      // Update thread metadata
      await this.updateThreadMetadata(thread, threadAge, hasNewEvents);

      logger.info(`✅ Checked thread ${thread.threadId}`, {
        hasNewEvents,
        threadAge,
      });
    } catch (error) {
      logger.error(`Error checking thread ${thread.threadId}:`, error);
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

  /**
   * Update thread metadata after checking
   */
  private async updateThreadMetadata(
    thread: any,
    threadAge: number,
    hasNewEvents: boolean
  ): Promise<void> {
    const env = IS_DEMO_MODE ? "DEMO" : CURRENT_ENV;
    const nextCheckDelay = this.calculateNextCheckDelay();
    const nextCheckAt = new Date(Date.now() + nextCheckDelay);

    await prisma.emailThread.update({
      where: { threadId: thread.threadId },
      data: {
        lastCheckedAt: new Date(),
        metadata: {
          lastCheckedAt: new Date().toISOString(),
          nextCheckAt: hasNewEvents ? null : nextCheckAt.toISOString(),
          environment: env,
          threadAge,
          checkFrequency: {
            env,
            threadAge,
            nextCheckDelay,
          },
        },
      },
    });
  }
}
