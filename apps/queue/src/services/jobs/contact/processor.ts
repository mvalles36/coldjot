import { Queue, Job } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { logger } from "@/lib/log";
import { prisma } from "@mailjot/database";
import { QueueService } from "@/services/queue/queue-service";
import {
  EmailJobEnum,
  SequenceContactStatusEnum,
  type EmailJob,
} from "@mailjot/types";
import { randomUUID } from "crypto";
import { schedulingService } from "@/services/schedule/scheduling-service";
import { rateLimiter } from "@/services/rate-limit/rate-limiter";
import {
  getUserGoogleAccount,
  getDefaultBusinessHours,
  updateSequenceContactStatus,
} from "@/services/sequence/helper";
import { CONTACT_PROCESSING_CONFIG } from "@/config";
import { QUEUE_NAMES } from "@/config/queue/queue";

export class ContactProcessor extends BaseProcessor<any> {
  private queueService: QueueService;
  private checkInterval: number = CONTACT_PROCESSING_CONFIG.CHECK_INTERVAL;
  private batchSize: number = CONTACT_PROCESSING_CONFIG.BATCH_SIZE;

  constructor(queue: Queue) {
    super(queue, QUEUE_NAMES.CONTACT, {
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
    this.queueService = QueueService.getInstance();
  }

  protected async process(job: Job<any>): Promise<void> {
    try {
      await this.processNewContacts();
    } catch (error) {
      logger.error(`Failed to process contact job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Process new contacts with not_sent status
   */
  private async processNewContacts(): Promise<void> {
    try {
      logger.info("🔍 Checking for new contacts to process");

      // Find contacts that haven't been processed yet
      const newContacts = await prisma.sequenceContact.findMany({
        where: {
          status: SequenceContactStatusEnum.NOT_STARTED,
          lastProcessedAt: null,
        },
        include: {
          sequence: {
            include: {
              steps: {
                orderBy: {
                  order: "asc",
                },
              },
              businessHours: true,
            },
          },
          contact: true,
        },
        take: this.batchSize,
      });

      logger.info(`📥 Found ${newContacts.length} new contacts to process`);

      // Process each contact
      for (const contact of newContacts) {
        try {
          await this.processContact(contact);
        } catch (error) {
          logger.error(
            `❌ Error processing contact ${contact.contact.email}:`,
            error
          );
          // Continue with next contact even if one fails
          continue;
        }
      }

      logger.info("✅ Completed processing batch of new contacts");
    } catch (error) {
      logger.error("❌ Error in processNewContacts:", error);
      throw error;
    }
  }

  /**
   * Process an individual contact
   */
  private async processContact(contact: any): Promise<void> {
    const { sequence, contact: contactDetails } = contact;

    logger.info(`👤 Processing contact: ${contactDetails.email}`, {
      sequenceId: sequence.id,
      contactId: contactDetails.id,
    });

    try {
      // 1. Check rate limits
      const { allowed, info } = await rateLimiter.checkRateLimit(
        sequence.userId,
        sequence.id,
        contactDetails.id
      );

      if (!allowed) {
        logger.warn("⚠️ Rate limit exceeded:", info);
        return;
      }

      // 2. Update status to processing
      await updateSequenceContactStatus(
        sequence.id,
        contact.id,
        SequenceContactStatusEnum.PENDING
      );

      // 3. Get first step of sequence
      const firstStep = sequence.steps[0];
      if (!firstStep) {
        throw new Error("Sequence has no steps");
      }

      // 4. Get user's Google account
      const googleAccount = await getUserGoogleAccount(sequence.userId);
      if (!googleAccount) {
        throw new Error(
          `No valid email account found for user ${sequence.userId}`
        );
      }

      // 5. Calculate send time using scheduling service
      const sendTime = await schedulingService.calculateNextRun(
        new Date(),
        firstStep,
        sequence.businessHours || getDefaultBusinessHours()
      );

      if (!sendTime) {
        throw new Error("Could not calculate send time");
      }

      // 6. Create email job
      const emailJob: EmailJob = {
        id: randomUUID(),
        type: EmailJobEnum.SEND,
        priority: 1,
        data: {
          sequenceId: sequence.id,
          contactId: contactDetails.id,
          stepId: firstStep.id,
          userId: sequence.userId,
          to: contactDetails.email,
          subject: firstStep.subject || "",
          scheduledTime: sendTime.toISOString(),
        },
      };

      // 7. Add to queue
      await this.queueService.addEmailJob(emailJob);

      logger.info(`📧 Created email job for contact: ${contactDetails.email}`);

      // 8. Update contact status and progress
      await updateSequenceContactStatus(
        sequence.id,
        contact.id,
        SequenceContactStatusEnum.SCHEDULED,
        {
          currentStep: 1,
        }
      );

      // 9. Increment rate limit counters
      await rateLimiter.incrementCounters(
        sequence.userId,
        sequence.id,
        contactDetails.id
      );

      logger.info(`✅ Successfully processed contact: ${contactDetails.email}`);
    } catch (error) {
      logger.error(
        error,
        `❌ Error processing contact ${contactDetails.email}:`
      );

      // Update status to failed
      await updateSequenceContactStatus(
        sequence.id,
        contact.id,
        SequenceContactStatusEnum.FAILED
      );

      // Re-throw error for higher-level handling
      throw error;
    }
  }
}
