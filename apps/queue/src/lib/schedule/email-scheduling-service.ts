import { logger } from "@/lib/log/logger";
import { QueueService } from "@/lib/queue/queue-service";
import { prisma } from "@mailjot/database";
import { StepStatus } from "@mailjot/types";
import { randomUUID } from "crypto";
import { schedulingService } from "./scheduling-service";
import { rateLimiter } from "@/lib/rate-limit/rate-limiter";
import type { EmailJob } from "@/types/queue";
import type { Sequence, SequenceStep, BusinessHours } from "@mailjot/types";
import type { Prisma } from "@prisma/client";

// Define the type for what we actually need from the sequence
type SequenceWithRelations = {
  id: string;
  userId: string;
  steps: SequenceStep[];
  businessHours: BusinessHours | null;
};

// Define our email processing type
interface SequenceProgressWithRelations {
  id: string;
  sequenceId: string;
  contactId: string;
  currentStepIndex: number;
  lastProcessedAt: Date | null;
  nextScheduledAt: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sequence: SequenceWithRelations;
  contact: {
    id: string;
    email: string;
  };
}

interface NextEmailScheduler {
  checkInterval: number; // milliseconds
  retryDelay: number; // milliseconds
}

export class EmailSchedulingService {
  private queueService: QueueService;
  private intervalId?: NodeJS.Timeout;
  private scheduler: NextEmailScheduler = {
    checkInterval: 60000, // 1 minute
    retryDelay: 300000, // 5 minutes
  };

  constructor() {
    this.queueService = QueueService.getInstance();
  }

  /**
   * Start the scheduling service
   */
  public async start(): Promise<void> {
    logger.info("🚀 Starting email scheduling service");

    // Initial processing
    await this.processScheduledEmails();

    // Set up interval for continuous processing
    this.intervalId = setInterval(() => {
      this.processScheduledEmails().catch((error) => {
        logger.error("❌ Error in email scheduling interval:", error);
      });
    }, this.scheduler.checkInterval);

    logger.info("✓ Email scheduling service started");
  }

  /**
   * Stop the scheduling service
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("⏹️ Email scheduling service stopped");
    }
  }

  /**
   * Process emails that are due to be sent
   */
  private async processScheduledEmails(): Promise<void> {
    try {
      logger.info("🔍 Checking for scheduled emails to process");

      // Find emails that are due to be sent
      const dueEmails = await prisma.sequenceProgress.findMany({
        where: {
          nextScheduledAt: {
            lte: new Date(),
          },
          completed: false,
        },
        include: {
          sequence: {
            select: {
              id: true,
              userId: true,
              steps: {
                orderBy: {
                  order: "asc",
                },
              },
              businessHours: true,
            },
          },
          contact: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      logger.info(`📥 Found ${dueEmails.length} emails to process`);

      // Process each email
      for (const email of dueEmails) {
        try {
          await this.processEmail(email as SequenceProgressWithRelations);
        } catch (error) {
          logger.error(
            `❌ Error processing email for contact ${email.contact.email}:`,
            error
          );
          // Continue with next email even if one fails
          continue;
        }
      }

      logger.info("✅ Completed processing batch of scheduled emails");
    } catch (error) {
      logger.error("❌ Error in processScheduledEmails:", error);
      throw error;
    }
  }

  /**
   * Process an individual email
   */
  private async processEmail(
    email: SequenceProgressWithRelations
  ): Promise<void> {
    const { sequence, contact } = email;

    logger.info(`📧 Processing email for contact: ${contact.email}`, {
      sequenceId: sequence.id,
      contactId: contact.id,
    });

    try {
      // 1. Check rate limits
      const { allowed, info } = await rateLimiter.checkRateLimit(
        sequence.userId,
        sequence.id,
        contact.id
      );

      if (!allowed) {
        logger.warn("⚠️ Rate limit exceeded:", info);
        return;
      }

      // 2. Get current step
      const currentStep = sequence.steps[email.currentStepIndex];
      if (!currentStep) {
        throw new Error("Step not found");
      }

      // 3. Calculate next send time using scheduling service
      const nextSendTime = await schedulingService.calculateNextRun(
        new Date(),
        currentStep,
        sequence.businessHours || undefined
      );

      if (!nextSendTime) {
        throw new Error("Could not calculate next send time");
      }

      // 4. Create email job
      const emailJob: EmailJob = {
        id: randomUUID(),
        type: "send",
        priority: 1,
        data: {
          sequenceId: sequence.id,
          contactId: contact.id,
          stepId: currentStep.id,
          userId: sequence.userId,
          to: contact.email,
          subject: currentStep.subject || "",
          scheduledTime: nextSendTime.toISOString(),
        },
      };

      // 5. Add to queue
      await this.queueService.addEmailJob(emailJob);

      logger.info(`📧 Created email job for contact: ${contact.email}`, {
        jobId: emailJob.id,
        scheduledTime: nextSendTime,
      });

      // 6. Update sequence progress
      const isLastStep = email.currentStepIndex + 1 >= sequence.steps.length;
      await prisma.sequenceProgress.update({
        where: { id: email.id },
        data: {
          lastProcessedAt: new Date(),
          nextScheduledAt: isLastStep ? null : nextSendTime,
          currentStepIndex: email.currentStepIndex + 1,
          completed: isLastStep,
          completedAt: isLastStep ? new Date() : null,
        },
      });

      // 7. Create step status
      await prisma.stepStatus.create({
        data: {
          sequenceId: sequence.id,
          stepId: currentStep.id,
          contactId: contact.id,
          status: "scheduled",
          scheduledAt: nextSendTime,
        },
      });

      // 8. Increment rate limit counters
      await rateLimiter.incrementCounters(
        sequence.userId,
        sequence.id,
        contact.id
      );

      logger.info(
        `✅ Successfully processed email for contact: ${contact.email}`
      );
    } catch (error) {
      logger.error(
        `❌ Error processing email for contact ${contact.email}:`,
        error
      );

      // Update step status to failed
      await prisma.stepStatus.create({
        data: {
          sequenceId: sequence.id,
          stepId: sequence.steps[email.currentStepIndex]?.id || "",
          contactId: contact.id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      // Schedule retry
      await prisma.sequenceProgress.update({
        where: { id: email.id },
        data: {
          nextScheduledAt: new Date(Date.now() + this.scheduler.retryDelay),
        },
      });

      // Re-throw error for higher-level handling
      throw error;
    }
  }
}

// Export singleton instance
export const emailSchedulingService = new EmailSchedulingService();
