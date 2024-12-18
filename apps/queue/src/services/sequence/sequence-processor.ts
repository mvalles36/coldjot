import { ProcessingJob, EmailJob } from "../../types/queue";
import { logger } from "@/services/log/logger";
import { rateLimiter } from "@/services/rate-limit/rate-limiter";
import { schedulingService } from "@/services/schedule/scheduling-service";
import { SequenceStep, StepStatus } from "@mailjot/types";
import { QueueService } from "@/services/queue/queue-service";
import { randomUUID } from "crypto";
import {
  getUserGoogleAccount,
  getDefaultBusinessHours,
  updateSequenceContactStatus,
  updateSequenceContactProgress,
  getActiveSequenceContacts,
  getSequenceWithDetails,
  getContactProgress,
} from "./helper";
import { createEmailTracking } from "../track/tracking-service";

export class SequenceProcessor {
  private queueService: QueueService;

  constructor() {
    this.queueService = QueueService.getInstance();
  }

  /**
   * Process a sequence job
   */
  async processSequenceJob(
    job: ProcessingJob
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = job;
    logger.info(`🚀 Starting sequence: ${data.sequenceId}`, {
      jobId: job.id,
      testMode: data.testMode ? "✨ Test Mode" : "🔥 Production Mode",
    });

    try {
      // Check rate limits first
      const { allowed, info } = await rateLimiter.checkRateLimit(
        data.userId,
        data.sequenceId
      );

      if (!allowed) {
        logger.warn("⚠️ Rate limit exceeded:", info);
        return { success: false, error: "Rate limit exceeded" };
      }

      // Get sequence and validate
      const sequence = await getSequenceWithDetails(data.sequenceId);
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
      for (const contact of contacts) {
        logger.info(`👤 Processing contact: ${contact.contact.email}`, {
          sequence: sequence.name,
        });

        // Check contact rate limit
        const contactRateLimit = await rateLimiter.checkRateLimit(
          data.userId,
          data.sequenceId,
          contact.contact.id
        );

        if (!contactRateLimit.allowed) {
          logger.warn("⚠️ Contact rate limit exceeded:", contactRateLimit.info);
          continue;
        }

        // Get contact's progress
        const progress = await getContactProgress(
          data.sequenceId,
          contact.contact.id
        );
        const currentStepIndex = progress?.currentStepIndex ?? 0;

        // Log progress status
        logger.info(`📊 Contact progress:`, {
          contact: contact.contact.email,
          currentStep: currentStepIndex + 1,
          totalSteps: sequence.steps.length,
          hasExistingProgress: !!progress,
        });

        // Check if sequence is completed
        if (currentStepIndex >= sequence.steps.length) {
          logger.info(
            `✅ Sequence completed for contact: ${contact.contact.email}`
          );
          await updateSequenceContactStatus(
            contact.id,
            StepStatus.COMPLETED,
            new Date()
          );
          continue;
        }

        // Get current step
        const currentStep = sequence.steps[currentStepIndex];
        if (!currentStep) {
          logger.error(
            `❌ Step not found at index ${currentStepIndex} for sequence ${sequence.name}`
          );
          continue;
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

        // const sendTime = await schedulingService.calculateNextRun(
        //   new Date(),
        //   firstStep,
        //   sequence.businessHours || getDefaultBusinessHours()
        // );

        // Calculate next send time using the new timing service
        const nextSendTime = schedulingService.calculateNextRun(
          new Date(), // current time
          currentStep as SequenceStep,
          sequence.businessHours || getDefaultBusinessHours()
        );

        logger.info(
          `📅 Scheduling email for contact: ${contact.contact.email}`,
          {
            step: currentStepIndex + 1,
            totalSteps: sequence.steps.length,
            sendTime: nextSendTime.toISOString(),
            subject: currentStep.subject,
          }
        );

        // TODO : remove this as it' will run on sequence start only
        // Get previous subject from previous step if replyToThread is true
        const previousStep = sequence.steps[currentStepIndex - 1];
        const previousSubject = previousStep?.subject || "";

        const subject = currentStep.replyToThread
          ? `Re: ${previousSubject}`
          : currentStep.subject;

        // Create email job
        const emailJob: EmailJob = {
          id: randomUUID(),
          type: "send",
          priority: 1,
          data: {
            sequenceId: sequence.id,
            contactId: contact.contact.id,
            stepId: currentStep.id,
            userId: data.userId,
            to: data.testMode
              ? process.env.TEST_EMAIL || googleAccount.email || ""
              : contact.contact.email,
            subject: subject || "",
            threadId: contact.threadId || undefined,
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

        const queuedJob = await this.queueService.addEmailJob(emailJob);

        // Update progress
        await updateSequenceContactProgress(
          sequence.id,
          contact.contact.id,
          currentStepIndex + 1,
          nextSendTime
        );

        // Update contact status
        await updateSequenceContactStatus(contact.id, StepStatus.SCHEDULED);

        // Increment rate limit counters
        await rateLimiter.incrementCounters(
          data.userId,
          sequence.id,
          contact.contact.id
        );

        // Add rate limiting delay between contacts
        // TODO: Remove this delay
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
}

// Export singleton instance
export const sequenceProcessor = new SequenceProcessor();
