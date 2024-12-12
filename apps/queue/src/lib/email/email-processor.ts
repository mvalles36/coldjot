import { EmailJob } from "@/types/queue";
import { logger } from "../log/logger";
import { rateLimiter } from "../rate-limit/rate-limiter";
import { emailService } from "./email-service";
import { JOB_PRIORITIES } from "../queue/queue-config";
import { QueueService } from "../queue/queue-service";
import { prisma } from "@mailjot/database";
import { randomUUID } from "crypto";
import { SequenceStep, StepStatus } from "@prisma/client";

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
    logger.info(`📨 Processing email for sequence: ${data.sequenceId}`);

    try {
      await this.validateRateLimits(data);
      const step = await this.getAndValidateSequenceStep(data.stepId);

      if (step.sequence.status !== "active") {
        logger.info(
          `⏸️ Sequence ${step.sequence.name} is not active, skipping email`
        );
        return { success: true };
      }

      const emailResult = await this.sendEmailAndLogResult(data, step);

      if (emailResult.success) {
        await this.handleSuccessfulEmail(data, emailResult, step);
      }

      return { success: true };
    } catch (error) {
      await this.handleEmailError(error, job, data);
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
    });

    try {
      const bounceStatus = await this.checkAndHandleBounceStatus(data);
      return { success: true, ...bounceStatus };
    } catch (error) {
      await this.handleBounceCheckError(error, data);
      throw error;
    }
  }

  // Helper functions for processEmail
  private async validateRateLimits(data: EmailJob["data"]) {
    const { allowed, info } = await rateLimiter.checkRateLimit(
      data.userId,
      data.sequenceId,
      data.contactId
    );

    if (!allowed) {
      logger.warn(info, "⚠️ Rate limit exceeded:");
      throw new Error("Rate limit exceeded");
    }
  }

  private async getAndValidateSequenceStep(stepId: string) {
    const step = await prisma.sequenceStep.findUnique({
      where: { id: stepId },
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
      throw new Error(`Step ${stepId} not found`);
    }

    return step;
  }

  private async sendEmailAndLogResult(
    data: EmailJob["data"],
    step: SequenceStep & { sequence: { name: string; status: string } }
  ) {
    logger.info(`🔄 Sending email to: ${data.emailOptions.to}`, {
      tracking: data.tracking,
      sequence: step.sequence.name,
      step: step.order + 1,
    });

    const result = await emailService.sendEmail({
      ...data.emailOptions,
      tracking: data.tracking,
      account: data.account,
      userId: data.userId,
      sequenceId: data.sequenceId,
      contactId: data.contactId,
      stepId: data.stepId,
    });

    logger.info(result, "Email Result");
    return result;
  }

  private async handleSuccessfulEmail(
    data: EmailJob["data"],
    result: { success: boolean; messageId?: string; threadId?: string },
    step: SequenceStep & { sequence: { name: string; status: string } }
  ) {
    logger.info(`✅ Email sent successfully`, {
      to: data.emailOptions.to,
      messageId: result.messageId,
      threadId: result.threadId,
      sentAt: new Date().toISOString(),
      sequence: step.sequence.name,
      step: step.order + 1,
    });

    await this.updateStepStatus(data, result);
    await this.scheduleBounceCheck(data, result, step);
  }

  private async updateStepStatus(
    data: EmailJob["data"],
    result: { messageId?: string; threadId?: string }
  ) {
    const stepStatusData = {
      sequenceId: data.sequenceId,
      stepId: data.stepId,
      contactId: data.contactId,
      status: "sent",
      sentAt: new Date(),
      messageId: result.messageId,
      threadId: result.threadId,
    };

    logger.info("🔄 Step Status Data");

    await prisma.stepStatus.upsert({
      where: {
        sequenceId_stepId_contactId: {
          sequenceId: data.sequenceId,
          stepId: data.stepId,
          contactId: data.contactId,
        },
      },
      update: stepStatusData,
      create: {
        ...stepStatusData,
        sequenceId: data.sequenceId,
        stepId: data.stepId,
        contactId: data.contactId,
      },
    });
  }

  private async scheduleBounceCheck(
    data: EmailJob["data"],
    result: { messageId?: string },
    step: SequenceStep & { sequence: { name: string } }
  ) {
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
        checkTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        sequence: step.sequence.name,
      });
    }
  }

  private async handleEmailError(
    error: unknown,
    job: EmailJob,
    data: EmailJob["data"]
  ) {
    logger.error(
      {
        to: data.emailOptions.to,
        subject: data.emailOptions.subject,
        error: error instanceof Error ? error.message : "Unknown error",
        jobId: job.id,
      },
      `❌ Error sending email: ${error}`
    );

    await this.addErrorCooldown(data.userId);
    await this.updateStepStatusWithError(data, error);
  }

  private async addErrorCooldown(userId: string) {
    await rateLimiter.addCooldown(
      userId,
      "error",
      15 * 60 * 1000 // 15 minutes
    );
  }

  private async updateStepStatusWithError(
    data: EmailJob["data"],
    error: unknown
  ) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await prisma.stepStatus.upsert({
      where: {
        sequenceId_stepId_contactId: {
          sequenceId: data.sequenceId,
          stepId: data.stepId,
          contactId: data.contactId,
        },
      },
      update: {
        status: "failed",
        error: errorMessage,
      },
      create: {
        sequenceId: data.sequenceId,
        stepId: data.stepId,
        contactId: data.contactId,
        status: "failed",
        error: errorMessage,
      },
    });
  }

  // Helper functions for checkBounce
  private async checkAndHandleBounceStatus(data: EmailJob["data"]) {
    const bounceStatus = await emailService.checkBounceStatus(data.messageId!);

    if (bounceStatus.bounced) {
      await this.handleBouncedEmail(data, bounceStatus);
    } else {
      logger.info(`✅ Email delivered successfully`, {
        messageId: data.messageId,
        to: data.emailOptions.to,
      });
    }

    return bounceStatus;
  }

  private async handleBouncedEmail(
    data: EmailJob["data"],
    bounceStatus: { details?: string }
  ) {
    logger.warn(`⚠️ Email bounced`, {
      messageId: data.messageId,
      to: data.emailOptions.to,
      reason: bounceStatus.details,
    });

    await this.updateBounceStatus(data, bounceStatus);
    await this.addBounceCooldown(data.userId);
  }

  private async updateBounceStatus(
    data: EmailJob["data"],
    bounceStatus: { details?: string }
  ) {
    await prisma.stepStatus.upsert({
      where: {
        sequenceId_stepId_contactId: {
          sequenceId: data.sequenceId,
          stepId: data.stepId,
          contactId: data.contactId,
        },
      },
      update: {
        status: "bounced",
        bounceInfo: bounceStatus.details,
      },
      create: {
        sequenceId: data.sequenceId,
        stepId: data.stepId,
        contactId: data.contactId,
        status: "bounced",
        bounceInfo: bounceStatus.details,
      },
    });
  }

  private async addBounceCooldown(userId: string) {
    await rateLimiter.addCooldown(
      userId,
      "bounce",
      24 * 60 * 60 * 1000 // 24 hours
    );
  }

  private async handleBounceCheckError(error: unknown, data: EmailJob["data"]) {
    logger.error(`❌ Error checking bounce status: ${error}`, {
      messageId: data.messageId,
      to: data.emailOptions.to,
    });
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();
