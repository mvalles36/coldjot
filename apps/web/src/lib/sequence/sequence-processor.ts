import { queueService } from "@/lib/queue/queue-service";
import { rateLimiter } from "@/lib/queue/rate-limiter";
import { calculateNextSendTime } from "@/lib/sequence/timing-service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { JOB_PRIORITIES, JOB_TYPES } from "@/lib/queue/queue-config";
import type { ProcessingJob, EmailJob } from "@/lib/queue/types";
import type { BusinessHours } from "@/types";

class SequenceProcessor {
  async processSequence(sequenceId: string, userId: string): Promise<void> {
    try {
      // Get sequence and its steps
      const sequence = await prisma.sequence.findUnique({
        where: { id: sequenceId },
        include: {
          steps: {
            orderBy: { order: "asc" },
          },
          businessHours: true,
        },
      });

      if (!sequence) {
        throw new Error(`Sequence ${sequenceId} not found`);
      }

      // Get contacts for this sequence
      const contacts = await prisma.sequenceContact.findMany({
        where: {
          sequenceId,
        },
        include: {
          contact: true,
        },
      });

      // Process each contact
      for (const sequenceContact of contacts) {
        await this.processContact(
          {
            id: sequence.id,
            steps: sequence.steps,
            businessHours: sequence.businessHours
              ? {
                  timezone: sequence.businessHours.timezone,
                  workDays: sequence.businessHours.workDays,
                  workHours: sequence.businessHours.workHours as {
                    start: string;
                    end: string;
                  },
                  holidays: sequence.businessHours.holidays,
                }
              : null,
          },
          sequenceContact.contactId,
          userId
        );
      }
    } catch (error) {
      logger.error(`Error processing sequence ${sequenceId}:`, error);
      throw error;
    }
  }

  private async processContact(
    sequence: {
      id: string;
      steps: any[];
      businessHours?: BusinessHours | null;
    },
    contactId: string,
    userId: string
  ): Promise<void> {
    try {
      // Check rate limits first
      const { allowed, info } = await rateLimiter.checkRateLimit(
        userId,
        sequence.id,
        contactId
      );

      if (!allowed) {
        logger.warn("Rate limit exceeded:", info);
        return;
      }

      // Get contact's progress in sequence
      const progress = await prisma.sequenceProgress.findFirst({
        where: {
          sequenceId: sequence.id,
          contactId: contactId,
        },
      });

      // Find next step to process
      const currentStepIndex = progress?.currentStepIndex || 0;
      const nextStep = sequence.steps[currentStepIndex];

      if (!nextStep) {
        // Sequence completed for this contact
        await this.completeSequenceForContact(sequence.id, contactId);
        return;
      }

      // Calculate next send time based on business hours
      const nextSendTime = await calculateNextSendTime(
        nextStep.timing,
        {
          amount: nextStep.delayAmount || 0,
          unit:
            (nextStep.delayUnit as "minutes" | "hours" | "days") || "minutes",
        },
        sequence.businessHours ?? {
          timezone: "UTC",
          workDays: [1, 2, 3, 4, 5],
          workHours: { start: "09:00", end: "17:00" },
          holidays: [],
        }
      );

      if (!nextSendTime) {
        logger.warn(
          `Could not calculate next send time for step ${nextStep.id}`
        );
        return;
      }

      // Create processing job for this step
      const processingJob: ProcessingJob = {
        id: `${sequence.id}-${contactId}-${nextStep.id}`,
        priority: JOB_PRIORITIES.NORMAL,
        timestamp: new Date(),
        userId,
        type: "step",
        data: {
          sequenceId: sequence.id,
          contactId,
          stepId: nextStep.id,
          scheduleType: sequence.businessHours ? "business" : "custom",
          businessHours: sequence.businessHours || undefined,
        },
      };

      await queueService.addProcessingJob(processingJob);

      // Increment rate limit counters
      await rateLimiter.incrementCounters(userId, sequence.id, contactId);

      // Update progress
      await prisma.sequenceProgress.upsert({
        where: {
          sequenceId_contactId: {
            sequenceId: sequence.id,
            contactId,
          },
        },
        update: {
          currentStepIndex: currentStepIndex + 1,
          lastProcessedAt: new Date(),
          nextScheduledAt: nextSendTime,
        },
        create: {
          sequenceId: sequence.id,
          contactId,
          currentStepIndex: 1,
          lastProcessedAt: new Date(),
          nextScheduledAt: nextSendTime,
        },
      });
    } catch (error) {
      logger.error(
        `Error processing contact ${contactId} in sequence ${sequence.id}:`,
        error
      );
      throw error;
    }
  }

  async processStep(
    sequenceId: string,
    stepId: string,
    contactId: string,
    userId: string
  ): Promise<void> {
    try {
      // Get step details
      const step = await prisma.sequenceStep.findUnique({
        where: { id: stepId },
        include: {
          sequence: {
            include: {
              businessHours: true,
            },
          },
        },
      });

      if (!step || !step.subject || !step.content) {
        throw new Error(`Step ${stepId} not found or incomplete`);
      }

      // Get contact details
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!contact) {
        throw new Error(`Contact ${contactId} not found`);
      }

      // Get user's email account
      const account = await prisma.account.findFirst({
        where: { userId },
        select: {
          access_token: true,
          refresh_token: true,
          providerAccountId: true,
        },
      });

      if (!account || !account.access_token || !account.refresh_token) {
        throw new Error(`No valid email account found for user ${userId}`);
      }

      // Create email job
      const emailJob: EmailJob = {
        id: `${sequenceId}-${contactId}-${stepId}-email`,
        priority: JOB_PRIORITIES.HIGH,
        timestamp: new Date(),
        userId,
        type: "send",
        data: {
          sequenceId,
          contactId,
          stepId,
          emailOptions: {
            to: contact.email,
            subject: step.subject,
            content: step.content,
            threadId: step.threadId || undefined,
          },
          tracking: {
            id: `${sequenceId}-${contactId}-${stepId}`,
            hash: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: "email",
            wrappedLinks: true,
            metadata: {
              userId,
              sequenceId,
              stepId,
              contactId,
              email: contact.email,
            },
          },
          account: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            providerAccountId: account.providerAccountId,
          },
        },
      };

      await queueService.addEmailJob(emailJob);

      // Update step status
      await prisma.stepStatus.create({
        data: {
          sequenceId,
          stepId,
          contactId,
          status: "scheduled",
          scheduledAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        logger.error(
          `Error processing step ${stepId} for contact ${contactId}:`,
          error
        );

        // Add error cooldown
        await rateLimiter.addCooldown(
          userId,
          "error",
          15 * 60 * 1000 // 15 minutes
        );
      }
      throw error;
    }
  }

  private async completeSequenceForContact(
    sequenceId: string,
    contactId: string
  ): Promise<void> {
    try {
      await prisma.sequenceProgress.update({
        where: {
          sequenceId_contactId: {
            sequenceId,
            contactId,
          },
        },
        data: {
          completed: true,
          completedAt: new Date(),
        },
      });

      logger.info(`Sequence ${sequenceId} completed for contact ${contactId}`);
    } catch (error) {
      logger.error(
        `Error completing sequence ${sequenceId} for contact ${contactId}:`,
        error
      );
      throw error;
    }
  }
}

// Export singleton instance
export const sequenceProcessor = new SequenceProcessor();
