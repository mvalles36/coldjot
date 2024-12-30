import { Job, Queue } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { logger } from "@/lib/log";
import { prisma } from "@mailjot/database";
import {
  SendEmailOptions,
  EmailResult,
  SequenceContactStatusEnum,
  EmailEventEnum,
  EmailTrackingStatusEnum,
  EmailLabelEnum,
  type EmailTrackingMetadata,
  type SequenceStep,
  StepTypeEnum,
  type EmailJob,
} from "@mailjot/types";
import { rateLimitService } from "@/services/core/rate-limit/service";
import { addTrackingToEmail, createEmailTracking } from "@/lib/tracking";
import { gmailClientService } from "@/lib/google";
import { ScheduleProcessor } from "@/services/jobs/schedule/processor";
// import { emailSchedulingService } from "@/services/v1/schedule/email-scheduling-service";
import { ServiceManager } from "@/services/service-manager";
import {
  getDefaultBusinessHours,
  updateSequenceContactThreadId,
  updateSequenceContactStatus,
} from "@/services/v1/sequence/helper";
import { emailService } from "@/lib/email";
import { QUEUE_NAMES } from "@/config/queue/queue";

export class EmailProcessor extends BaseProcessor<EmailJob> {
  private serviceManager = ServiceManager.getInstance();
  private jobManager = this.serviceManager.getJobManager();

  constructor(queue: Queue) {
    super(queue, QUEUE_NAMES.EMAIL, {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000, // 1 second
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
  }

  protected async process(job: Job<EmailJob>): Promise<void> {
    try {
      logger.info(job.data, `📨 Starting to process email job`);
      const result = await this.processEmail(job.data);
      if (!result.success) {
        throw new Error(result.error || "Failed to process email");
      }
    } catch (error) {
      logger.error(`Failed to process email job ${job.id}:`, error);
      throw error;
    }
  }

  private async processEmail(
    data: EmailJob
  ): Promise<{ success: boolean; error?: string }> {
    logger.info(data, `📨 Starting to process email job`);

    try {
      // Check if thread has already received a reply or bounce
      const shouldProceed = await this.checkThreadEvents(data);
      if (!shouldProceed) {
        logger.info("📭 Skipping email send due to existing thread events");
        return { success: true };
      }

      // Validate rate limits
      logger.info(
        `🔍 Checking rate limits for user ${data.userId} --- sequence ${data.sequenceId} --- contact ${data.contactId}`
      );
      await this.validateRateLimits(data);

      // Get current step with sequence info
      logger.info(`🔍 Fetching sequence step ${data.stepId}`);
      const step = await this.getAndValidateSequenceStep(data.stepId);

      // Get contact info
      logger.info(`🔍 Fetching contact info ${data.contactId}`);
      const contact = await prisma.contact.findUnique({
        where: { id: data.contactId },
      });

      if (!contact) {
        throw new Error(`Contact ${data.contactId} not found`);
      }

      // Get Google account info
      logger.info(`🔍 Fetching Google account info ${data.userId}`);
      const googleAccount = await prisma.account.findFirst({
        where: { userId: data.userId },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      if (!googleAccount) {
        throw new Error(`No Google account found for user ${data.userId}`);
      }

      // Create tracking metadata
      logger.info("📊 Creating tracking metadata");
      const trackingMetadata: EmailTrackingMetadata = {
        email: data.to,
        userId: data.userId,
        sequenceId: data.sequenceId,
        stepId: data.stepId,
        contactId: data.contactId,
      };

      // Create tracking object
      const tracking = await createEmailTracking(trackingMetadata);
      if (!tracking) {
        throw new Error("Failed to create tracking information");
      }

      // Prepare email options
      logger.info(
        {
          to: data.to,
          subject: data.subject || step.subject,
          threadId: data.threadId,
          testMode: data.testMode,
        },
        "📧 Preparing email options"
      );
      const emailOptions: SendEmailOptions = {
        to: data.to,
        subject: data.subject || step.subject || "",
        html: step.content || "",
        replyTo: googleAccount.user.email || "",
        threadId: data.threadId || "",
        tracking: tracking,
        account: {
          email: googleAccount.user.email!,
          accessToken: googleAccount.access_token!,
          refreshToken: googleAccount.refresh_token!,
          expiryDate: googleAccount.expires_at!,
        },
        userId: data.userId,
        sequenceId: data.sequenceId,
        contactId: data.contactId,
        stepId: data.stepId,
        testMode: data.testMode,
      };

      // Send email
      logger.info(
        {
          to: emailOptions.to,
          subject: emailOptions.subject,
          testMode: emailOptions.testMode,
        },
        "📤 Sending email"
      );
      const emailResult = await emailService.sendEmail(emailOptions);

      if (emailResult.success) {
        logger.info(
          {
            messageId: emailResult.messageId,
            threadId: emailResult.threadId,
          },
          "✅ Email sent successfully"
        );

        await this.handleSuccessfulEmail(data, emailResult, step);

        // Save information in EmailThread
        if (step.order === 0) {
          await prisma.emailThread.create({
            data: {
              threadId: emailResult.threadId,
              sequenceId: data.sequenceId,
              contactId: data.contactId,
              userId: data.userId,
              firstMessageId: emailResult.messageId,
              subject: data.subject || step.subject || "",
            },
          });
        }

        // Update contact threadId
        await updateSequenceContactThreadId(
          contact.id,
          data.sequenceId,
          emailResult.threadId
        );

        // If in test mode, trigger the next email in sequence after a short delay
        if (data.testMode) {
          await this.testEmailSequence();
        }
      }

      return { success: true };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          ...data,
        },
        "❌ Error processing email - 1"
      );
      await this.handleEmailError(error, data);
      throw error;
    }
  }

  private validateEmailData(data: EmailJob): void {
    if (!data.to) {
      throw new Error("Email recipient is required");
    }
    if (!data.subject) {
      throw new Error("Email subject is required");
    }
    if (!data.userId) {
      throw new Error("User ID is required");
    }
    if (!data.stepId) {
      throw new Error("Step ID is required");
    }
  }

  private async validateRateLimits(data: EmailJob) {
    const { allowed, info } = await rateLimitService.checkRateLimit(
      data.userId,
      data.sequenceId,
      data.contactId
    );

    if (!allowed) {
      logger.warn(info, "⚠️ Rate limit exceeded:");
      throw new Error("Rate limit exceeded");
    }
  }

  private async getAndValidateSequenceStep(
    stepId: string
  ): Promise<SequenceStep> {
    const step = await prisma.sequenceStep.findUnique({
      where: { id: stepId },
      include: {
        sequence: {
          select: {
            id: true,
            userId: true,
            status: true,
            name: true,
          },
        },
      },
    });

    if (!step) {
      logger.error(`❌ Step ${stepId} not found - it may have been deleted`);
      throw new Error(`Step ${stepId} not found - it may have been deleted`);
    }

    // Cast the step to include required StepTypeEnum
    return {
      ...step,
      stepType: step.stepType as StepTypeEnum,
    } as SequenceStep;
  }

  private async handleSuccessfulEmail(
    data: EmailJob,
    result: EmailResult,
    step: any
  ) {
    // Get the total steps of a sequence
    const totalSteps = await prisma.sequenceStep.count({
      where: { sequenceId: data.sequenceId },
    });

    // If the current step is not the last step, update the status to in progress
    if (step.order < totalSteps - 1) {
      await updateSequenceContactStatus(
        data.sequenceId,
        data.contactId,
        SequenceContactStatusEnum.IN_PROGRESS
      );
    }

    // if the current step is the last step, update the status to completed
    if (step.order === totalSteps - 1) {
      await updateSequenceContactStatus(
        data.sequenceId,
        data.contactId,
        SequenceContactStatusEnum.COMPLETED
      );
    }

    logger.info(
      {
        messageId: result.messageId,
        threadId: result.threadId,
        to: data.to,
        step: step.order + 1,
      },
      "✅ Email sent successfully"
    );
  }

  private async handleEmailError(error: unknown, data: EmailJob) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        to: data.to,
        sequenceId: data.sequenceId,
        stepId: data.stepId,
      },
      "❌ Error processing email - 2"
    );
  }

  private async testEmailSequence() {
    logger.info(
      "🧪 Test mode: Triggering next email in sequence in 10 seconds"
    );

    // const { nextEmail } = await emailSchedulingService.checkNextScheduledEmail();
    // if (nextEmail) {
    //   logger.info("🧪 Test mode: Processing next email in sequence");
    //   await emailSchedulingService.advanceToNextEmail();
    //   await schedulingService.resetTime();
    // }
  }

  private async checkThreadEvents(data: EmailJob): Promise<boolean> {
    logger.info(
      `🔍 Checking thread events for sequence ${data.sequenceId} and contact ${data.contactId}`
    );

    // If there's no threadId, it means this is a new thread, so allow it
    if (!data.threadId) {
      return true;
    }

    // Check for existing bounce or reply events
    const existingEvents = await prisma.emailEvent.findMany({
      where: {
        sequenceId: data.sequenceId,
        contactId: data.contactId,
        type: {
          in: ["BOUNCED", "replied"],
        },
      },
    });

    if (existingEvents.length > 0) {
      const eventTypes = existingEvents.map((event) => event.type).join(", ");
      logger.warn(
        `⚠️ Thread already has ${eventTypes} event(s). Skipping email send.`,
        {
          threadId: data.threadId,
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          events: existingEvents,
        }
      );
      return false;
    }

    return true;
  }
}
