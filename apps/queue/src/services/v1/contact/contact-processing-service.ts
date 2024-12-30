import { logger } from "@/lib/log";
import { QueueService } from "@/services/v1/queue/queue-service";
import { prisma } from "@mailjot/database";
import {
  EmailJobEnum,
  SequenceContactStatusEnum,
  StepStatus,
} from "@mailjot/types";
import { randomUUID } from "crypto";
import { schedulingService } from "../schedule/scheduling-service";
import { rateLimiter } from "@/services/v1/rate-limit/rate-limiter";
import {
  getUserGoogleAccount,
  getDefaultBusinessHours,
  updateSequenceContactStatus,
} from "../sequence/helper";
import type { EmailJob, EmailJobOld } from "@mailjot/types";
import { CONTACT_PROCESSING_CONFIG } from "@/config";

export class ContactProcessingService {
  private queueService: QueueService;
  private checkInterval: number = CONTACT_PROCESSING_CONFIG.CHECK_INTERVAL;
  private batchSize: number = CONTACT_PROCESSING_CONFIG.BATCH_SIZE;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.queueService = QueueService.getInstance();
  }

  /**
   * Start the contact processing service
   */
  public async start(): Promise<void> {
    logger.info("🚀 Starting contact processing service");

    // Initial processing
    await this.processNewContacts();

    // Set up interval for continuous processing
    this.intervalId = setInterval(() => {
      this.processNewContacts().catch((error) => {
        logger.error("❌ Error in contact processing interval:", error);
      });
    }, this.checkInterval);
  }

  /**
   * Stop the contact processing service
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("⏹️ Contact processing service stopped");
    }
  }

  /**
   * Process new contacts with not_sent status
   */
  public async processNewContacts(): Promise<void> {
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
      // await prisma.sequenceContact.update({
      //   where: { id: contact.id },
      //   data: {
      //     status: SequenceContactStatusEnum.PENDING,
      //     lastProcessedAt: new Date(),
      //   },
      // });

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
      const emailJob: EmailJobOld = {
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
      ),
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
      // TODO: Update the where clause properly
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

// Export singleton instance
export const contactProcessingService = new ContactProcessingService();
