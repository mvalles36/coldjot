import { EmailJob } from "@/types/queue";
import { logger } from "../log/logger";
import { rateLimiter } from "../rate-limit/rate-limiter";
import { emailService } from "./email-service";
import { JOB_PRIORITIES } from "../queue/queue-config";
import { QueueService } from "../queue/queue-service";
import { prisma } from "@mailjot/database";
import { randomUUID } from "crypto";

export class EmailProcessor {
  private queueService: QueueService;

  constructor() {
    this.queueService = QueueService.getInstance();
  }

  /**
   * Process an email job
   */
  async processEmail(
    job: EmailJob
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = job;
    logger.info(`📨 Processing email for sequence: ${data.sequenceId}`, {
      to: data.emailOptions.to,
      subject: data.emailOptions.subject,
      step: data.stepId,
      jobId: job.id,
    });

    try {
      // Check rate limits
      const { allowed, info } = await rateLimiter.checkRateLimit(
        data.userId,
        data.sequenceId,
        data.contactId
      );

      if (!allowed) {
        logger.warn("⚠️ Rate limit exceeded:", info);
        return { success: false, error: "Rate limit exceeded" };
      }

      // Get sequence step details
      const step = await prisma.sequenceStep.findUnique({
        where: { id: data.stepId },
        include: {
          sequence: {
            select: {
              name: true,
              status: true,
            },
          },
        },
      });

      if (!step) {
        throw new Error(`Step ${data.stepId} not found`);
      }

      if (step.sequence.status !== "active") {
        logger.info(
          `⏸️ Sequence ${step.sequence.name} is not active, skipping email`
        );
        return { success: true };
      }

      logger.info(`🔄 Sending email to: ${data.emailOptions.to}`, {
        tracking: {
          opens: data.tracking.openTracking ? "✓" : "✗",
          clicks: data.tracking.clickTracking ? "✓" : "✗",
          unsubscribe: data.tracking.unsubscribeTracking ? "✓" : "✗",
        },
        sequence: step.sequence.name,
        step: step.order + 1,
      });

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
        logger.info(`✅ Email sent successfully`, {
          to: data.emailOptions.to,
          messageId: result.messageId,
          threadId: result.threadId,
          sentAt: new Date().toISOString(),
          sequence: step.sequence.name,
          step: step.order + 1,
        });

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
          await this.queueService.addEmailJob({
            id: randomUUID(),
            type: "bounce_check",
            priority: JOB_PRIORITIES.LOW,
            data: {
              ...data,
              messageId: result.messageId,
            },
          });
          logger.info(`🔍 Scheduled bounce check`, {
            messageId: result.messageId,
            checkTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
            sequence: step.sequence.name,
          });
        }
      }

      return { success: true };
    } catch (error) {
      logger.error(`❌ Error sending email: ${error}`, {
        to: data.emailOptions.to,
        subject: data.emailOptions.subject,
        error: error instanceof Error ? error.message : "Unknown error",
        jobId: job.id,
      });

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
    logger.info(`🔍 Checking bounce status for email: ${data.messageId}`, {
      to: data.emailOptions.to,
      // sentAt: data.emailOptions.sentAt,
    });

    try {
      const bounceStatus = await emailService.checkBounceStatus(
        data.messageId!
      );

      if (bounceStatus.bounced) {
        logger.warn(`⚠️ Email bounced`, {
          messageId: data.messageId,
          to: data.emailOptions.to,
          reason: bounceStatus.details,
        });

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
      } else {
        logger.info(`✅ Email delivered successfully`, {
          messageId: data.messageId,
          to: data.emailOptions.to,
        });
      }

      return { success: true, ...bounceStatus };
    } catch (error) {
      logger.error(`❌ Error checking bounce status: ${error}`, {
        messageId: data.messageId,
        to: data.emailOptions.to,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();
