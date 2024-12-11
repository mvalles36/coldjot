import { EmailJob } from "../../types/queue";
import { logger } from "../logger";
import { rateLimiter } from "../rate-limiter";
import { emailService } from "./email-service";
import { JOB_PRIORITIES } from "../queue/queue-config";
import { queueService } from "../queue/queue-service";
import { prisma } from "@mailjot/database";

export class EmailProcessor {
  constructor() {}

  /**
   * Process an email job
   */
  async processEmail(
    job: EmailJob
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = job;
    logger.info(`Processing email job: ${data.sequenceId}`, {
      contactId: data.contactId,
      stepId: data.stepId,
    });

    try {
      // Check rate limits
      const { allowed, info } = await rateLimiter.checkRateLimit(
        data.userId,
        data.sequenceId,
        data.contactId
      );

      if (!allowed) {
        logger.warn("Rate limit exceeded:", info);
        return { success: false, error: "Rate limit exceeded" };
      }

      // Send email
      const result = await emailService.sendEmail({
        ...data.emailOptions,
        tracking: {
          enabled: data.tracking.enabled,
          openTracking: data.tracking.openTracking,
          clickTracking: data.tracking.clickTracking,
          unsubscribeTracking: data.tracking.unsubscribeTracking,
        },
        account: data.account,
        userId: data.userId,
        sequenceId: data.sequenceId,
        contactId: data.contactId,
        stepId: data.stepId,
      });

      if (result.success) {
        // Update step status
        await prisma.stepStatus.update({
          where: {
            sequenceId_stepId_contactId: {
              sequenceId: data.sequenceId,
              stepId: data.stepId,
              contactId: data.contactId,
            },
          },
          data: {
            status: "sent",
            sentAt: new Date(),
            messageId: result.messageId,
            threadId: result.threadId,
          },
        });

        // Schedule bounce check
        if (result.messageId) {
          await queueService.addEmailJob({
            type: "bounce_check",
            priority: JOB_PRIORITIES.LOW,
            data: {
              ...data,
              messageId: result.messageId,
            },
          });
        }
      }

      return { success: true };
    } catch (error) {
      logger.error(`Error processing email: ${error}`);

      // Add error cooldown
      await rateLimiter.addCooldown(
        data.userId,
        "error",
        15 * 60 * 1000 // 15 minutes
      );

      // Update step status
      await prisma.stepStatus.update({
        where: {
          sequenceId_stepId_contactId: {
            sequenceId: data.sequenceId,
            stepId: data.stepId,
            contactId: data.contactId,
          },
        },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  }

  /**
   * Check for email bounce
   */
  async checkBounce(
    job: EmailJob
  ): Promise<{ success: boolean; bounced?: boolean }> {
    const { data } = job;
    logger.info(`Checking bounce for email: ${data.messageId}`);

    try {
      const bounceStatus = await emailService.checkBounceStatus(
        data.messageId!
      );

      if (bounceStatus.bounced) {
        // Update step status
        await prisma.stepStatus.update({
          where: {
            sequenceId_stepId_contactId: {
              sequenceId: data.sequenceId,
              stepId: data.stepId,
              contactId: data.contactId,
            },
          },
          data: {
            status: "bounced",
            bounceInfo: bounceStatus.details,
          },
        });

        // Add bounce cooldown
        await rateLimiter.addCooldown(
          data.userId,
          "bounce",
          24 * 60 * 60 * 1000 // 24 hours
        );
      }

      return { success: true, ...bounceStatus };
    } catch (error) {
      logger.error(`Error checking bounce status: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();
