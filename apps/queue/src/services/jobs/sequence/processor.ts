import { Queue } from "bullmq";
import {
  ProcessingJob,
  EmailJob,
  EmailJobEnum,
  SequenceContactStatusEnum,
  SequenceStep,
  StepStatus,
  StepPriority,
  StepTiming,
  StepTypeEnum,
  BusinessHours,
  StepType,
} from "@mailjot/types";
import { logger } from "@/lib/log";
import { RateLimitService } from "@/services/core/rate-limit/service";
import { ScheduleGenerator, scheduleGenerator } from "@/lib/schedule";
import { randomUUID } from "crypto";
import { prisma } from "@mailjot/database";
import {
  getUserGoogleAccount,
  getDefaultBusinessHours,
  updateSequenceContactStatus,
  updateSequenceContactProgress,
  getActiveSequenceContacts,
  getSequenceWithDetails,
  getContactProgress,
} from "./helper";
import { QUEUE_NAMES } from "@/config/queue/queue";

// Define our sequence processing types
interface SequenceWithRelations {
  id: string;
  userId: string;
  name?: string;
  steps: SequenceStep[];
  businessHours: BusinessHours | null;
}

interface SequenceContactWithRelations {
  id: string;
  sequenceId: string;
  contactId: string;
  currentStep: number;
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
  threadId?: string;
}

export class SequenceProcessor {
  private queue: Queue;
  private rateLimitService: RateLimitService;
  private scheduleGenerator: ScheduleGenerator;

  constructor(queue: Queue) {
    this.queue = queue;
    this.rateLimitService = RateLimitService.getInstance();
    this.scheduleGenerator = scheduleGenerator;
  }

  /**
   * Process a sequence job
   */
  async process(
    job: ProcessingJob
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = job;
    logger.info(`🚀 Starting sequence: ${data.sequenceId}`, {
      jobId: job.id,
      testMode: data.testMode ? "✨ Test Mode" : "🔥 Production Mode",
    });

    try {
      // Check rate limits first
      const { allowed, info } = await this.rateLimitService.checkRateLimit(
        data.userId,
        data.sequenceId
      );

      if (!allowed) {
        logger.warn("⚠️ Rate limit exceeded:", info);
        return { success: false, error: "Rate limit exceeded" };
      }

      // Get sequence and validate
      const sequence = await getSequenceWithDetails(data.sequenceId);
      logger.info(sequence, "🎮 Sequence");

      if (!sequence) {
        throw new Error("Sequence not found");
      }

      logger.info(`📋 Sequence details for ${sequence.name}:`, {
        steps: sequence.steps.length,
        businessHours: sequence.businessHours ? "✓" : "✗",
      });

      // Get active contacts
      const contacts = await getActiveSequenceContacts(data.sequenceId);
      logger.info(`👥 Processing contacts:`, {
        total: contacts.length,
        sequence: sequence.name,
      });

      // Get user's Google account
      const googleAccount = await getUserGoogleAccount(data.userId);
      if (!googleAccount) {
        throw new Error(`No valid email account found for user ${data.userId}`);
      }

      // Process each contact
      for (const sequenceContact of contacts) {
        logger.info(`👤 Processing contact: ${sequenceContact.contact.email}`, {
          sequence: sequence.name,
        });

        // Check contact rate limit
        const contactRateLimit = await this.rateLimitService.checkRateLimit(
          data.userId,
          data.sequenceId,
          sequenceContact.contact.id
        );

        if (!contactRateLimit.allowed) {
          logger.warn("⚠️ Contact rate limit exceeded:", contactRateLimit.info);
          continue;
        }

        // Get contact's progress
        const progress = await getContactProgress(
          data.sequenceId,
          sequenceContact.contact.id
        );
        const currentStepIndex = progress?.currentStep ?? 0;

        // Log progress status
        logger.info(`📊 Contact progress:`, {
          contact: sequenceContact.contact.email,
          currentStep: currentStepIndex + 1,
          totalSteps: sequence.steps.length,
          hasExistingProgress: !!progress,
        });

        // Check if sequence is completed
        if (currentStepIndex >= sequence.steps.length) {
          logger.info(
            `✅ Sequence completed for contact: ${sequenceContact.contact.email}`
          );
          await updateSequenceContactStatus(
            sequence.id,
            sequenceContact.contact.id,
            SequenceContactStatusEnum.COMPLETED
          );
          continue;
        }

        // Get current step
        // const currentStepIndex = sequenceContact.currentStep;
        const currentStep = sequence.steps[currentStepIndex];
        if (!currentStep) {
          logger.error(
            `❌ Step not found at index ${currentStepIndex} for sequence ${sequence.name}`
          );
          continue;
        }

        // Get next step
        const nextStep = sequence.steps[currentStepIndex + 1];
        if (!nextStep) {
          logger.info(
            `ℹ️ No next step found - this is the last step for sequence ${sequence.name}`
          );
        }

        // Log step details
        logger.info(`📝 Processing step ${currentStepIndex + 1}:`, {
          step: currentStepIndex + 1,
          totalSteps: sequence.steps.length,
          timing: currentStep.timing,
          delay: {
            amount: currentStep.delayAmount || 0,
            unit: currentStep.delayUnit || "minutes",
          },
        });

        // Calculate next send time using scheduling service
        const nextSendTime = this.scheduleGenerator.calculateNextRun(
          new Date(),
          nextStep as SequenceStep,
          sequence.businessHours || getDefaultBusinessHours()
        );

        logger.info(
          `📅 Scheduling email for contact: ${sequenceContact.contact.email}`,
          {
            step: currentStepIndex + 1,
            totalSteps: sequence.steps.length,
            sendTime: nextSendTime.toISOString(),
            subject: currentStep.subject,
          }
        );

        // Get previous subject from previous step if replyToThread is true
        const previousStep = sequence.steps[currentStepIndex - 1];
        const previousSubject = previousStep?.subject || "";
        const subject = currentStep.replyToThread
          ? `Re: ${previousSubject}`
          : currentStep.subject;

        // Create email job
        const emailJob: EmailJob = {
          id: randomUUID(),
          type: EmailJobEnum.SEND,
          priority: 1,
          data: {
            sequenceId: sequence.id,
            contactId: sequenceContact.contact.id,
            stepId: currentStep.id,
            userId: data.userId,
            to: data.testMode
              ? process.env.TEST_EMAIL || googleAccount.email || ""
              : sequenceContact.contact.email,
            subject: subject || "",
            threadId: sequenceContact.threadId || undefined,
            testMode: data.testMode || false,
            scheduledTime: nextSendTime.toISOString(),
          },
        };

        // Add email job to queue
        logger.info(
          {
            jobId: emailJob.id,
            step: currentStepIndex + 1,
            totalSteps: sequence.steps.length,
          },
          `📬 Creating email job`
        );

        await this.queue.add(QUEUE_NAMES.EMAIL, emailJob.data, {
          jobId: emailJob.id,
          priority: emailJob.priority,
          delay: nextSendTime.getTime() - Date.now(),
        });

        // Update progress
        await updateSequenceContactProgress(
          sequence.id,
          sequenceContact.contact.id,
          currentStepIndex + 1,
          nextSendTime
        );

        // Update contact status
        logger.info(
          `📊 Updating contact status: ${sequenceContact.contact.id} to SCHEDULED`
        );
        await updateSequenceContactStatus(
          sequence.id,
          sequenceContact.contact.id,
          SequenceContactStatusEnum.SCHEDULED
        );

        // Increment rate limit counters
        await this.rateLimitService.incrementCounters(
          data.userId,
          sequence.id,
          sequenceContact.contact.id
        );

        // Add rate limiting delay between contacts
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      logger.info(`✨ Sequence processing completed: ${sequence.name}`, {
        totalContacts: contacts.length,
        totalSteps: sequence.steps.length,
      });

      return { success: true };
    } catch (error) {
      logger.error(`❌ Error processing sequence job: ${job.id}`, error);
      throw error;
    }
  }

  /**
   * Process an individual email
   */
  private async processEmail(
    email: SequenceContactWithRelations,
    testMode?: boolean
  ): Promise<void> {
    const { sequence, contact } = email;

    logger.info("📧 Processing email", {
      id: email.id,
      sequenceId: sequence.id,
      contactId: contact.id,
      email: contact.email,
      currentStep: email.currentStep,
      totalSteps: sequence.steps.length,
    });

    try {
      // 1. Check rate limits
      const { allowed, info } = await this.rateLimitService.checkRateLimit(
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
      const currentStep = sequence.steps[email.currentStep];
      if (!currentStep) {
        logger.error("❌ Step not found", {
          sequenceId: sequence.id,
          currentStep: email.currentStep,
          totalSteps: sequence.steps.length,
        });

        // Verify if the step still exists
        const stepExists = await prisma.sequenceStep.findFirst({
          where: {
            sequenceId: sequence.id,
            order: email.currentStep,
          },
        });

        if (!stepExists) {
          logger.info("🗑️ Step has been deleted, cleaning up", {
            sequenceId: sequence.id,
            currentStep: email.currentStep,
          });

          // If this was the last step, mark as completed
          if (email.currentStep >= sequence.steps.length - 1) {
            await prisma.sequenceContact.update({
              where: { id: email.id },
              data: {
                completed: true,
                completedAt: new Date(),
                nextScheduledAt: null,
              },
            });
            logger.info(
              "✅ Marked sequence as completed due to deleted last step"
            );
          } else {
            // Skip to next step
            await prisma.sequenceContact.update({
              where: { id: email.id },
              data: {
                currentStep: email.currentStep + 1,
                nextScheduledAt: new Date(),
              },
            });
            logger.info("⏭️ Skipped deleted step, moving to next step");
          }
          return;
        }

        throw new Error("Step not found");
      }

      // 3. Calculate next send time
      const nextSendTime = this.scheduleGenerator.calculateNextRun(
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

      // Get previous subject for reply threads
      const previousStep = sequence.steps[currentStep.order - 1];
      const previousSubject = previousStep?.subject || "";
      const subject = currentStep.replyToThread
        ? `Re: ${previousSubject}`
        : currentStep.subject;

      // Get threadId if exists
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

      // Get user's Google account for test mode
      let testEmail = "";
      if (testMode) {
        const googleAccount = await getUserGoogleAccount(sequence.userId);
        if (googleAccount) {
          testEmail = process.env.TEST_EMAIL || googleAccount.email || "";
        }
      }

      // 4. Create email job
      const emailJob: EmailJob = {
        id: randomUUID(),
        type: EmailJobEnum.SEND,
        priority: 1,
        data: {
          sequenceId: sequence.id,
          contactId: contact.id,
          stepId: currentStep.id,
          userId: sequence.userId,
          to: testMode ? testEmail : contact.email,
          subject: subject || "",
          threadId:
            currentStep.replyToThread && sequenceContact?.threadId
              ? sequenceContact.threadId
              : undefined,
          testMode: testMode || false,
          scheduledTime: nextSendTime.toISOString(),
        },
      };

      // 5. Add to queue
      await this.queue.add(QUEUE_NAMES.EMAIL, emailJob.data, {
        jobId: emailJob.id,
        priority: emailJob.priority,
        delay: nextSendTime.getTime() - Date.now(),
      });

      // 6. Update sequence progress
      const isLastStep = email.currentStep + 1 >= sequence.steps.length;

      await prisma.sequenceContact.update({
        where: { id: email.id },
        data: {
          lastProcessedAt: new Date(),
          nextScheduledAt: isLastStep ? null : nextSendTime,
          currentStep: email.currentStep + 1,
          completed: isLastStep,
          completedAt: isLastStep ? new Date() : null,
        },
      });

      // Update contact status
      await updateSequenceContactStatus(
        sequence.id,
        contact.id,
        SequenceContactStatusEnum.SCHEDULED
      );

      // 7. Increment rate limit counters
      await this.rateLimitService.incrementCounters(
        sequence.userId,
        sequence.id,
        contact.id
      );

      // Add rate limiting delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      logger.info(
        {
          id: email.id,
          sequenceId: sequence.id,
          contactId: contact.id,
          email: contact.email,
          nextStep: email.currentStep + 1,
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

      // Schedule retry after delay
      await prisma.sequenceContact.update({
        where: { id: email.id },
        data: {
          nextScheduledAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
      });

      throw error;
    }
  }
}
