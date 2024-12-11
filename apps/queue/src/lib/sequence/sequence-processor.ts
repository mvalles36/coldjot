import { ProcessingJob, EmailJob, EmailTracking } from "../../types/queue";
import { logger } from "../logger";
import { rateLimiter } from "../rate-limiter";
import { calculateNextSendTime } from "../timing-service";
import { StepStatus } from "@mailjot/types";
import { queueService } from "../queue/queue-service";
import {
  getUserGoogleAccount,
  getDefaultBusinessHours,
  updateSequenceContactStatus,
  updateSequenceProgress,
  getActiveSequenceContacts,
  getSequenceWithDetails,
  getContactProgress,
} from "./helper";

export class SequenceProcessor {
  /**
   * Process a sequence job
   */
  async processSequenceJob(
    job: ProcessingJob
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = job;
    logger.info(`Processing sequence job: ${job.id}`, {
      sequenceId: data.sequenceId,
    });

    try {
      // Check rate limits first
      const { allowed, info } = await rateLimiter.checkRateLimit(
        data.userId,
        data.sequenceId
      );

      if (!allowed) {
        logger.warn("Rate limit exceeded:", info);
        return { success: false, error: "Rate limit exceeded" };
      }

      // Get sequence and validate
      const sequence = await getSequenceWithDetails(data.sequenceId);
      if (!sequence) {
        throw new Error("Sequence not found");
      }

      // Get active contacts
      const contacts = await getActiveSequenceContacts(data.sequenceId);

      // Get user's Google account
      const googleAccount = await getUserGoogleAccount(data.userId);
      if (!googleAccount) {
        throw new Error(`No valid email account found for user ${data.userId}`);
      }

      // Process each contact
      for (const contact of contacts) {
        // Check contact rate limit
        const contactRateLimit = await rateLimiter.checkRateLimit(
          data.userId,
          data.sequenceId,
          contact.contact.id
        );

        if (!contactRateLimit.allowed) {
          logger.warn("Contact rate limit exceeded:", contactRateLimit.info);
          continue;
        }

        // Get contact's progress
        const progress = await getContactProgress(
          data.sequenceId,
          contact.contact.id
        );
        const currentStepIndex = progress?.currentStepIndex || 0;
        const currentStep = sequence.steps[currentStepIndex];

        if (!currentStep) {
          // Sequence completed for this contact
          await updateSequenceContactStatus(
            contact.id,
            StepStatus.COMPLETED,
            new Date()
          );
          continue;
        }

        // Calculate next send time
        const nextSendTime = await calculateNextSendTime(
          currentStep.timing as "immediate" | "delay",
          {
            amount: currentStep.delayAmount || 0,
            unit:
              (currentStep.delayUnit as "minutes" | "hours" | "days") ||
              "minutes",
          },
          sequence.businessHours || getDefaultBusinessHours()
        );

        if (!nextSendTime) {
          logger.warn(
            `Could not calculate next send time for step ${currentStep.id}`
          );
          continue;
        }

        const tracking: EmailTracking = {
          enabled: true,
          openTracking: true,
          clickTracking: true,
          unsubscribeTracking: true,
        };

        // Create email job
        const emailJob: EmailJob = {
          type: "send",
          priority: 1,
          data: {
            sequenceId: sequence.id,
            contactId: contact.contact.id,
            stepId: currentStep.id,
            userId: data.userId,
            emailOptions: {
              to: data.testMode
                ? process.env.TEST_EMAIL || googleAccount.email
                : contact.contact.email,
              subject: currentStep.subject || "",
              html: currentStep.content || "",
              replyTo: googleAccount.email,
              threadId: contact.threadId || undefined,
            },
            tracking,
            account: googleAccount,
          },
        };

        // Add email job to queue
        await queueService.addEmailJob(emailJob);

        // Update progress
        await updateSequenceProgress(
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      return { success: true };
    } catch (error) {
      logger.error(`Error processing sequence job: ${job.id}`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const sequenceProcessor = new SequenceProcessor();
