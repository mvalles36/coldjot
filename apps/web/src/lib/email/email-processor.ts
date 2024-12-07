import { queueService } from "@/lib/queue/queue-service";
import { rateLimiter } from "@/lib/queue/rate-limiter";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { JOB_PRIORITIES, JOB_TYPES } from "@/lib/queue/queue-config";
import type { EmailJob } from "@/lib/queue/types";
import { google } from "googleapis";
import { addTrackingToEmail } from "@/lib/tracking/tracking-service";

class EmailProcessor {
  private async getGmailClient(account: {
    access_token: string;
    refresh_token: string;
  }) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    return google.gmail({ version: "v1", auth: oauth2Client });
  }

  async processEmail(job: EmailJob): Promise<void> {
    try {
      const { emailOptions, tracking, account } = job.data;

      // Add tracking to email content
      const trackedContent = await addTrackingToEmail(
        emailOptions.content,
        tracking
      );

      // Get Gmail client
      const gmail = await this.getGmailClient(account);

      // Prepare email
      const email = [
        `To: ${emailOptions.to}`,
        `Subject: ${emailOptions.subject}`,
        "Content-Type: text/html; charset=utf-8",
        "",
        trackedContent,
      ].join("\n");

      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send email
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedEmail,
          threadId: emailOptions.threadId,
        },
      });

      // Update tracking with message ID
      await prisma.emailTracking.create({
        data: {
          id: tracking.id,
          messageId: response.data.id,
          threadId: response.data.threadId,
          hash: tracking.hash,
          status: "sent",
          sentAt: new Date(),
          metadata: JSON.parse(JSON.stringify(tracking.metadata)),
        },
      });

      // Schedule bounce check
      const bounceCheckJob: EmailJob = {
        id: `bounce-check-${response.data.id}`,
        priority: JOB_PRIORITIES.LOW,
        timestamp: new Date(),
        userId: job.userId,
        type: "bounce_check",
        data: {
          ...job.data,
          messageId: response.data.id,
        } as EmailJob["data"],
      };

      await queueService.addEmailJob(bounceCheckJob);

      // Update step status
      await prisma.stepStatus.update({
        where: {
          sequenceId_stepId_contactId: {
            sequenceId: job.data.sequenceId,
            stepId: job.data.stepId,
            contactId: job.data.contactId,
          },
        },
        data: {
          status: "sent",
          sentAt: new Date(),
          messageId: response.data.id,
          threadId: response.data.threadId,
        },
      });

      logger.info(`Email sent successfully: ${response.data.id}`);
    } catch (error) {
      if (error instanceof Error) {
        logger.error("Error processing email:", error);

        // Add error cooldown
        await rateLimiter.addCooldown(
          job.userId,
          "error",
          15 * 60 * 1000 // 15 minutes
        );

        // Update step status
        await prisma.stepStatus.update({
          where: {
            sequenceId_stepId_contactId: {
              sequenceId: job.data.sequenceId,
              stepId: job.data.stepId,
              contactId: job.data.contactId,
            },
          },
          data: {
            status: "failed",
            error: error.message,
          },
        });
      }

      throw error;
    }
  }

  async checkBounce(job: EmailJob): Promise<void> {
    try {
      const messageId = job.data.messageId;
      if (!messageId) {
        throw new Error("No message ID provided for bounce check");
      }

      // Get Gmail client
      const gmail = await this.getGmailClient(job.data.account);

      // Get message details
      const message = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      // Check for bounce headers
      const headers = message.data.payload?.headers || [];
      const bounceHeader = headers.find(
        (h) => h.name?.toLowerCase() === "x-failed-recipients"
      );

      if (bounceHeader) {
        logger.warn(`Email bounced: ${messageId}`);

        // Update tracking
        await prisma.emailTracking.update({
          where: { messageId },
          data: {
            status: "bounced",
            bounceInfo: {
              recipients: bounceHeader.value,
              timestamp: new Date(),
            },
          },
        });

        // Update step status
        await prisma.stepStatus.update({
          where: {
            sequenceId_stepId_contactId: {
              sequenceId: job.data.sequenceId,
              stepId: job.data.stepId,
              contactId: job.data.contactId,
            },
          },
          data: {
            status: "bounced",
            bounceInfo: {
              recipients: bounceHeader.value,
              timestamp: new Date(),
            },
          },
        });

        // Add bounce cooldown
        await rateLimiter.addCooldown(
          job.userId,
          "bounce",
          24 * 60 * 60 * 1000 // 24 hours
        );
      }
    } catch (error) {
      logger.error("Error checking bounce:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailProcessor = new EmailProcessor();
