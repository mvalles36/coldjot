import { SendEmailOptions, EmailResult } from "@mailjot/types";
import { EmailJob } from "@mailjot/types";
import { logger } from "../log/logger";
import { rateLimiter } from "../rate-limit/rate-limiter";
import { emailService } from "./email-service";

import { QueueService } from "../queue/queue-service";
import { prisma } from "@mailjot/database";

import { SequenceStep, StepStatus } from "@prisma/client";
import { sendGmailSMTP } from "../google/smtp/gmail";
import { createEmailTracking } from "../track/tracking-service";
import { EmailTrackingMetadata } from "@mailjot/types";
import { gmailClientService } from "../google/gmail/gmail";
import type { gmail_v1 } from "googleapis";
import { schedulingService } from "../schedule/scheduling-service";
import { emailSchedulingService } from "../schedule/email-scheduling-service";
import { updateSequenceContactThreadId } from "../sequence/helper";
import { updateSequenceContactStatus } from "../sequence/helper";

export class EmailProcessor {
  private queueService: QueueService;

  constructor() {
    // TODO: check this and see if it is required anywhere
    this.queueService = QueueService.getInstance();
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * Process an email job
   */
  async processEmail(
    job: EmailJob
  ): Promise<{ success: boolean; error?: string }> {
    const { data } = job;
    logger.info(`📨 Starting to process email job`);

    try {
      // Validate rate limits
      logger.info(
        `🔍 Checking rate limits for user ${data.userId} --- sequence ${data.sequenceId} --- contact ${data.contactId}`
      );
      await this.validateRateLimits(data);

      // Get current step with sequence info
      logger.info(`🔍 Fetching sequence step ${data.stepId}`);
      const step = await this.getAndValidateSequenceStep(data.stepId);

      if (step.sequence.status !== "active") {
        logger.info(
          `⏸️ Sequence is not active, skipping email ${step.sequence.name}`
        );
        return { success: true };
      }

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
      const completeEmailOptions: SendEmailOptions = {
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

      // Complete email options
      logger.info("📧 Complete email options");

      // Send email
      logger.info(
        {
          to: completeEmailOptions.to,
          subject: completeEmailOptions.subject,
          testMode: completeEmailOptions.testMode,
        },
        "📤 Sending email"
      );
      const emailResult = await emailService.sendEmail(completeEmailOptions);
      // const emailResult = await sendGmailSMTP(completeEmailOptions);

      if (emailResult.success) {
        logger.info(
          {
            messageId: emailResult.messageId,
            threadId: emailResult.threadId,
          },
          "✅ Email sent successfully"
        );

        await this.handleSuccessfulEmail(data, emailResult, step);

        // Update contact threadId
        await updateSequenceContactThreadId(
          contact.id,
          data.sequenceId,
          emailResult.threadId
        );

        // If in test mode, trigger the next email in sequence after a short delay
        if (false) {
          await this.testEmailSequence();
        }
      }

      return { success: true };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          jobId: job.id,
          ...data,
        },
        "❌ Error processing email"
      );
      await this.handleEmailError(error, job, data);
      throw error;
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * Check for email bounce
   */
  async checkBounce(job: EmailJob): Promise<{ success: boolean }> {
    const { data } = job;
    logger.info(`📨 Checking bounce for email: ${data.messageId}`);

    try {
      // Get Google account info
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

      // Get Gmail client
      const gmail = await gmailClientService.getClient(data.userId);

      // Get message details
      const message = await gmail.users.messages.get({
        userId: "me",
        id: data.messageId!,
        format: "full",
      });

      // Check headers for bounce indicators
      const headers = message.data.payload?.headers || [];
      const subject =
        headers.find(
          (header: gmail_v1.Schema$MessagePartHeader) =>
            header.name === "Subject"
        )?.value || "";

      const from =
        headers.find(
          (header: gmail_v1.Schema$MessagePartHeader) => header.name === "From"
        )?.value || "";

      const bounceIndicators = [
        "Mail delivery failed",
        "Delivery Status Notification",
        "Undeliverable",
        "Failed Delivery",
        "Delivery Failure",
        "Non-Delivery Report",
      ];

      const isBounce = bounceIndicators.some(
        (indicator) =>
          subject.includes(indicator) || from.includes("MAILER-DAEMON")
      );

      if (isBounce) {
        logger.warn(
          {
            messageId: data.messageId,
            subject,
            from,
          },
          "📭 Bounce detected"
        );

        // Update tracking status
        await prisma.emailTracking.update({
          where: { id: data.messageId },
          data: {
            status: "BOUNCED",
            updatedAt: new Date(),
          },
        });

        // Update sequence contact status
        await prisma.sequenceContact.update({
          where: {
            sequenceId_contactId: {
              sequenceId: data.sequenceId,
              contactId: data.contactId,
            },
          },
          data: {
            status: "BOUNCED",
            updatedAt: new Date(),
          },
        });
      }

      return { success: true };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          jobId: job.id,
          messageId: data.messageId,
        },
        "❌ Error checking bounce"
      );
      throw error;
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

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

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

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

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private async handleSuccessfulEmail(
    data: EmailJob["data"],
    result: EmailResult,
    step: SequenceStep & { sequence: { name: string; status: string } }
  ) {
    // Get contact for logging
    const contact = await prisma.contact.findUnique({
      where: { id: data.contactId },
      select: { email: true },
    });

    logger.info(
      {
        messageId: result.messageId,
        threadId: result.threadId,
        to: contact?.email,
        step: step.order + 1,
      },
      "✅ Email sent successfully"
    );
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  private async handleEmailError(
    error: unknown,
    job: EmailJob,
    data: EmailJob["data"]
  ) {
    // Get contact for logging
    const contact = await prisma.contact.findUnique({
      where: { id: data.contactId },
      select: { email: true },
    });

    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        jobId: job.id,
        to: contact?.email,
        sequenceId: data.sequenceId,
        stepId: data.stepId,
      },
      "❌ Error processing email"
    );
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  // Example testing flow
  private async testEmailSequence() {
    logger.info(
      "🧪 Test mode: Triggering next email in sequence in 10 seconds"
    );

    const { nextEmail } =
      await emailSchedulingService.checkNextScheduledEmail();
    if (nextEmail) {
      logger.info("🧪 Test mode: Processing next email in sequence");
      await emailSchedulingService.advanceToNextEmail();
      await schedulingService.resetTime();
    }
  }
}
// Export singleton instance
export const emailProcessor = new EmailProcessor();
