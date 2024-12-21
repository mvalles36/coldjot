import { logger } from "@/services/log/logger";
import { QueueService } from "@/services/queue/queue-service";
import { prisma } from "@mailjot/database";
import { StepStatus } from "@mailjot/types";
import { randomUUID } from "crypto";
import { schedulingService } from "./scheduling-service";
import { rateLimiter } from "@/services/rate-limit/rate-limiter";
import type { EmailJob } from "@mailjot/types";
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
interface SequenceContactProgressWithRelations {
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
    logger.info("📧 Email Scheduling Service initialized", {
      checkInterval: this.scheduler.checkInterval,
      retryDelay: this.scheduler.retryDelay,
    });
  }

  /**
   * Start the scheduling service
   */
  public async start(): Promise<void> {
    logger.info("🚀 Starting email scheduling service", {
      timestamp: new Date().toISOString(),
    });

    // Initial processing
    await this.processScheduledEmails();

    // Set up interval for continuous processing
    this.intervalId = setInterval(() => {
      logger.debug("⏰ Running scheduled email processing interval");
      this.processScheduledEmails().catch((error) => {
        logger.error("❌ Error in email scheduling interval:", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        });
      });
    }, this.scheduler.checkInterval);

    logger.info("✓ Email scheduling service started", {
      nextCheck: new Date(
        Date.now() + this.scheduler.checkInterval
      ).toISOString(),
    });
  }

  /**
   * Stop the scheduling service
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info("⏹️ Email scheduling service stopped", {
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Process emails that are due to be sent
   */
  private async processScheduledEmails(): Promise<void> {
    try {
      logger.info("🔍 Checking for scheduled emails to process", {
        timestamp: new Date().toISOString(),
      });

      // Find emails that are due to be sent
      const dueEmails = await prisma.sequenceContactProgress.findMany({
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

      // Development mode: Log scheduled times for debugging
      const isDevelopment = process.env.APP_ENV === "development" ? true : true;
      if (isDevelopment) {
        logger.debug(
          {
            currentTime: new Date().toISOString(),
            scheduledEmails: dueEmails.map((email) => ({
              id: email.id,
              nextScheduledAt: email.nextScheduledAt?.toISOString(),
              email: email.contact.email,
              stepIndex: email.currentStepIndex,
            })),
          },
          "🔧 Development mode: Scheduled emails"
        );
      }

      logger.info("📥 Found emails to process", {
        count: dueEmails.length,
        emails: dueEmails.map((e) => ({
          id: e.id,
          sequenceId: e.sequenceId,
          contactId: e.contactId,
          currentStep: e.currentStepIndex,
          email: e.contact.email,
          scheduledTime: e.nextScheduledAt?.toISOString(),
        })),
      });

      // Process each email
      for (const email of dueEmails) {
        try {
          logger.debug(
            {
              id: email.id,
              sequenceId: email.sequenceId,
              contactId: email.contactId,
              currentStep: email.currentStepIndex,
              email: email.contact.email,
              step: email.sequence.steps[email.currentStepIndex],
            },
            "🔄 Processing email"
          );

          await this.processEmail(
            email as SequenceContactProgressWithRelations
          );
        } catch (error) {
          logger.error("❌ Error processing email", {
            id: email.id,
            sequenceId: email.sequenceId,
            contactId: email.contactId,
            email: email.contact.email,
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
          });
          // Continue with next email even if one fails
          continue;
        }
      }

      logger.info("✅ Completed processing batch of scheduled emails", {
        processedCount: dueEmails.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("❌ Error in processScheduledEmails:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Process an individual email
   */
  private async processEmail(
    email: SequenceContactProgressWithRelations
  ): Promise<void> {
    const { sequence, contact } = email;

    logger.info("📧 Processing email", {
      id: email.id,
      sequenceId: sequence.id,
      contactId: contact.id,
      email: contact.email,
      currentStep: email.currentStepIndex,
      totalSteps: sequence.steps.length,
    });

    try {
      // 1. Check rate limits
      logger.debug("🔍 Checking rate limits", {
        userId: sequence.userId,
        sequenceId: sequence.id,
        contactId: contact.id,
      });

      const { allowed, info } = await rateLimiter.checkRateLimit(
        sequence.userId,
        sequence.id,
        contact.id
      );

      if (!allowed) {
        logger.warn("⚠️ Rate limit exceeded", {
          userId: sequence.userId,
          sequenceId: sequence.id,
          contactId: contact.id,
          info,
        });
        return;
      }

      // 2. Get current step
      const currentStep = sequence.steps[email.currentStepIndex];

      if (!currentStep) {
        logger.error("❌ Step not found", {
          sequenceId: sequence.id,
          currentStepIndex: email.currentStepIndex,
          totalSteps: sequence.steps.length,
        });
        throw new Error("Step not found");
      }

      logger.debug("📋 Current step details", {
        stepId: currentStep.id,
        stepType: currentStep.stepType,
        timing: currentStep.timing,
        order: currentStep.order,
      });

      // 3. Calculate next send time using scheduling service
      logger.debug("🕒 Calculating next send time", {
        currentTime: new Date().toISOString(),
        hasBusinessHours: !!sequence.businessHours,
        businessHours: sequence.businessHours,
      });

      const nextSendTime = await schedulingService.calculateNextRun(
        new Date(),
        currentStep,
        sequence.businessHours || undefined
      );

      if (!nextSendTime) {
        logger.error("❌ Could not calculate next send time", {
          stepId: currentStep.id,
          timing: currentStep.timing,
          businessHours: sequence.businessHours,
        });
        throw new Error("Could not calculate next send time");
      }

      logger.debug("⏰ Next send time calculated", {
        nextSendTime: nextSendTime.toISOString(),
        delay: nextSendTime.getTime() - Date.now(),
      });

      const previousStep = currentStep.order - 1;
      const previousSubject = sequence.steps[previousStep]?.subject || "";

      // TODOD: Fix subject line handling. May be remove it
      const subject = currentStep.replyToThread
        ? `Re: ${previousSubject}`
        : currentStep.subject;

      // Get threadId from SequenceContact if it exists
      const sequenceContact = await prisma.sequenceContact.findUnique({
        where: {
          sequenceId_contactId: {
            sequenceId: sequence.id,
            contactId: contact.id,
          },
        },
        select: {
          threadId: true,
        },
      });

      // Log thread details for debugging
      logger.info(
        {
          sequenceId: sequence.id,
          contactId: contact.id,
          currentStepIndex: email.currentStepIndex,
          stepId: currentStep.id,
          replyToThread: currentStep.replyToThread,
          existingThreadId: sequenceContact?.threadId,
          willUseThreadId: currentStep.replyToThread
            ? sequenceContact?.threadId
            : undefined,
          subject,
          previousSubject,
          stepOrder: currentStep.order,
        },
        "🧵 Thread details for email creation"
      );

      if (currentStep.replyToThread && !sequenceContact?.threadId) {
        logger.warn(
          {
            stepId: currentStep.id,
            sequenceId: sequence.id,
            contactId: contact.id,
          },
          "⚠️ Reply to thread was requested but no thread ID found"
        );
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
          subject: subject || currentStep.subject || "",
          threadId:
            currentStep.replyToThread && sequenceContact?.threadId
              ? sequenceContact.threadId
              : undefined,
          scheduledTime: nextSendTime.toISOString(),
        },
      };

      logger.info(
        // {
        //   jobId: emailJob.id,
        //   threadId: emailJob.data.threadId,
        //   replyToThread: currentStep.replyToThread,
        //   stepIndex: email.currentStepIndex,
        // },
        "📧 Created email job with thread details"
      );

      // 5. Add to queue
      logger.debug(
        {
          jobId: emailJob.id,
          type: emailJob.type,
          priority: emailJob.priority,
          scheduledTime: emailJob.data.scheduledTime,
        },
        "📤 Adding email job to queue"
      );

      await this.queueService.addEmailJob(emailJob);

      logger.info(
        {
          jobId: emailJob.id,
          scheduledTime: nextSendTime.toISOString(),
          to: contact.email,
          sequenceId: sequence.id,
          stepId: currentStep.id,
        },
        "📧 Created email job"
      );

      // 6. Update sequence progress
      const isLastStep = email.currentStepIndex + 1 >= sequence.steps.length;
      logger.debug(
        {
          id: email.id,
          currentStep: email.currentStepIndex,
          isLastStep,
          nextScheduledAt: isLastStep ? null : nextSendTime,
        },
        "📝 Updating sequence progress"
      );

      await prisma.sequenceContactProgress.update({
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
      logger.debug(
        {
          sequenceId: sequence.id,
          stepId: currentStep.id,
          contactId: contact.id,
          status: "scheduled",
        },
        "📝 Creating step status"
      );

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
      logger.debug("🔄 Incrementing rate limit counters");

      await rateLimiter.incrementCounters(
        sequence.userId,
        sequence.id,
        contact.id
      );

      logger.info(
        {
          id: email.id,
          sequenceId: sequence.id,
          contactId: contact.id,
          email: contact.email,
          nextStep: email.currentStepIndex + 1,
          isComplete: isLastStep,
        },
        "✅ Successfully processed email"
      );
    } catch (error) {
      logger.error(
        {
          id: email.id,
          sequenceId: sequence.id,
          contactId: contact.id,
          email: contact.email,
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        "❌ Error processing email"
      );

      // Update step status to failed
      logger.debug(
        {
          sequenceId: sequence.id,
          stepId: sequence.steps[email.currentStepIndex]?.id,
          contactId: contact.id,
        },
        "📝 Creating failed step status"
      );

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
      logger.debug(
        {
          id: email.id,
          retryDelay: this.scheduler.retryDelay,
          nextRetry: new Date(
            Date.now() + this.scheduler.retryDelay
          ).toISOString(),
        },
        "🔄 Scheduling retry"
      );

      await prisma.sequenceContactProgress.update({
        where: { id: email.id },
        data: {
          nextScheduledAt: new Date(Date.now() + this.scheduler.retryDelay),
        },
      });

      // Re-throw error for higher-level handling
      throw error;
    }
  }

  // Add development helper method
  public async checkNextScheduledEmail(): Promise<{
    nextEmail?: {
      id: string;
      scheduledTime: Date | null;
      contact: string;
      step: number;
    };
    currentTime: Date;
  }> {
    if (process.env.APP_ENV !== "development") {
      logger.warn(
        "⚠️ checkNextScheduledEmail is only available in development mode"
      );
      return { currentTime: new Date() };
    }

    const nextEmail = await prisma.sequenceContactProgress.findFirst({
      where: {
        completed: false,
        nextScheduledAt: {
          not: null,
        },
      },
      orderBy: {
        nextScheduledAt: "asc",
      },
      select: {
        id: true,
        nextScheduledAt: true,
        currentStepIndex: true,
        contact: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!nextEmail) {
      logger.info("📭 No scheduled emails found");
      return { currentTime: new Date() };
    }

    logger.info("📧 Next scheduled email:", {
      id: nextEmail.id,
      scheduledTime: nextEmail.nextScheduledAt?.toISOString(),
      contact: nextEmail.contact.email,
      step: nextEmail.currentStepIndex,
      timeUntilSend: nextEmail.nextScheduledAt
        ? `${Math.round((nextEmail.nextScheduledAt.getTime() - Date.now()) / 1000 / 60)} minutes`
        : "unknown",
    });

    return {
      nextEmail: nextEmail
        ? {
            id: nextEmail.id,
            scheduledTime: nextEmail.nextScheduledAt,
            contact: nextEmail.contact.email,
            step: nextEmail.currentStepIndex,
          }
        : undefined,
      currentTime: new Date(),
    };
  }

  // Add method to advance time to next email
  public async advanceToNextEmail(): Promise<void> {
    if (process.env.APP_ENV !== "development") {
      logger.warn(
        "⚠️ advanceToNextEmail is only available in development mode"
      );
      return;
    }

    const { nextEmail } = await this.checkNextScheduledEmail();

    if (nextEmail?.scheduledTime) {
      // Add 1 second to ensure we're past the scheduled time
      const targetTime = new Date(nextEmail.scheduledTime.getTime() + 1000);

      logger.info("⏰ Advancing time to process next email", {
        from: new Date().toISOString(),
        to: targetTime.toISOString(),
        emailId: nextEmail.id,
        contact: nextEmail.contact,
      });

      // Use scheduling service to advance time
      schedulingService.advanceTimeTo(targetTime);

      // Trigger immediate check
      await this.processScheduledEmails();
    } else {
      logger.info("📭 No emails to advance to");
    }
  }
}

// Export singleton instance
export const emailSchedulingService = new EmailSchedulingService();
