import { Queue, Job } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { prisma } from "@mailjot/database";
import { logger } from "@/lib/log";

import {
  getUserGoogleAccount,
  getDefaultBusinessHours,
  updateSequenceContactStatus,
} from "@/services/jobs/sequence/helper";

import { CONTACT_PROCESSING_CONFIG } from "@/config";
import { QUEUE_NAMES } from "@/config";
import { getWorkerOptions } from "@/config";

import { ServiceManager } from "@/services/service-manager";

import { scheduleGenerator } from "@/lib/schedule";
import { rateLimitService } from "@/services/core/rate-limit/service";

import { SequenceContactStatusEnum, type EmailJob } from "@mailjot/types";

interface ContactProcessingJob {
  type: "CHECK_NEW_CONTACTS";
}

export class ContactProcessor extends BaseProcessor<ContactProcessingJob> {
  private checkInterval: number = CONTACT_PROCESSING_CONFIG.CHECK_INTERVAL;
  private batchSize: number = CONTACT_PROCESSING_CONFIG.BATCH_SIZE;
  private readonly SCHEDULER_ID = "contact-processing-scheduler";

  private serviceManager = ServiceManager.getInstance();
  private jobManager = this.serviceManager.getJobManager();

  constructor(queue: Queue) {
    super(queue, QUEUE_NAMES.CONTACT, getWorkerOptions(QUEUE_NAMES.CONTACT));
    this.setupContactProcessingScheduler();
  }

  /**
   * Set up the job scheduler for periodic contact checking
   */
  private async setupContactProcessingScheduler(): Promise<void> {
    try {
      // Create a job scheduler that runs every checkInterval milliseconds
      await this.queue.upsertJobScheduler(
        this.SCHEDULER_ID,
        { every: this.checkInterval },
        {
          // name: "check-new-contacts",
          // data: { type: "CHECK_NEW_CONTACTS" },
          opts: {
            removeOnComplete: true,
            removeOnFail: true,
          },
        }
      );
      logger.info(
        `📅 Contact processing scheduler initialized with ${this.checkInterval}ms interval`
      );
    } catch (error) {
      logger.error("❌ Failed to setup contact processing scheduler:", error);
      throw error;
    }
  }

  protected async process(job: Job<ContactProcessingJob>): Promise<void> {
    logger.info(`Processing contact job ${job.id}`);
    try {
      // if (job.data.type === "CHECK_NEW_CONTACTS") {
      await this.processNewContacts();
      // }
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

    logger.info(
      {
        sequenceId: sequence.id,
        contactId: contactDetails.id,
      },
      `👤 Processing contact: ${contactDetails.email}`
    );

    try {
      // 1. Check rate limits
      const { allowed, info } = await rateLimitService.checkRateLimit(
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
        contact.contact.id,
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

      // TODO: Do we really need this to check time here insteaf of while sending emails?
      // 5. Calculate send time using scheduling service
      const sendTime = await scheduleGenerator.calculateNextRun(
        new Date(),
        firstStep,
        sequence.businessHours || getDefaultBusinessHours()
      );

      if (!sendTime) {
        throw new Error("Could not calculate send time");
      }

      // 6. Create email job
      const emailJob: EmailJob = {
        sequenceId: sequence.id,
        contactId: contactDetails.id,
        stepId: firstStep.id,
        userId: sequence.userId,
        to: contactDetails.email,
        subject: firstStep.subject || "",
        scheduledTime: sendTime.toISOString(),
      };

      // 7. Add to queue
      // await this.queueService.addEmailJob(emailJob);
      await this.jobManager.addEmailJob(emailJob);

      logger.info(`📧 Created email job for contact: ${contactDetails.email}`);

      // 8. Update contact status and progress
      await updateSequenceContactStatus(
        sequence.id,
        contact.contact.id,
        SequenceContactStatusEnum.SCHEDULED,
        {
          currentStep: 1,
        }
      );

      // 9. Increment rate limit counters
      await rateLimitService.incrementCounters(
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
        contact.contact.id,
        SequenceContactStatusEnum.FAILED
      );

      // Re-throw error for higher-level handling
      throw error;
    }
  }
}
