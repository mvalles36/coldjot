import { google } from "googleapis";
import { prisma } from "@mailjot/database";
import { logger } from "./logger";
import { rateLimiter } from "./rate-limiter";
import type { EmailJob } from "../types/queue";
import { randomUUID } from "crypto";

export class EmailProcessor {
  private async getGmailClient(account: {
    accessToken: string;
    refreshToken: string;
  }) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
    });

    return google.gmail({ version: "v1", auth: oauth2Client });
  }

  private async addTrackingToEmail(
    content: string,
    tracking: any
  ): Promise<string> {
    if (!tracking.enabled) return content;

    let trackedContent = content;

    if (tracking.openTracking) {
      // Add pixel tracking
      const pixelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/tracking/pixel/${tracking.id}`;
      const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;
      trackedContent = trackedContent.replace("</body>", `${pixelTag}</body>`);
    }

    if (tracking.clickTracking) {
      // Add link tracking
      const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
      trackedContent = trackedContent.replace(
        linkRegex,
        (match, quote, url) => {
          const trackingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/tracking/link/${tracking.id}?url=${encodeURIComponent(url)}`;
          return `<a href=${quote}${trackingUrl}${quote}`;
        }
      );
    }

    if (tracking.unsubscribeTracking) {
      // Add unsubscribe link
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/tracking/unsubscribe/${tracking.id}`;
      const unsubscribeLink = `<br/><br/><p style="font-size: 12px; color: #666;">To unsubscribe, <a href="${unsubscribeUrl}">click here</a></p>`;
      trackedContent = trackedContent.replace(
        "</body>",
        `${unsubscribeLink}</body>`
      );
    }

    return trackedContent;
  }

  async processEmail(job: EmailJob): Promise<void> {
    try {
      const { emailOptions, tracking, account } = job.data;

      // Add tracking to email content
      const trackedContent = await this.addTrackingToEmail(
        emailOptions.html,
        tracking
      );

      // Get Gmail client
      const gmail = await this.getGmailClient(account);

      // Prepare email
      const email = [
        `To: ${emailOptions.to}`,
        `Subject: ${emailOptions.subject}`,
        "Content-Type: text/html; charset=utf-8",
        emailOptions.replyTo ? `Reply-To: ${emailOptions.replyTo}` : "",
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

      // Create email tracking record
      const emailId = randomUUID();
      await prisma.emailTracking.create({
        data: {
          id: emailId,
          messageId: response.data.id || null,
          threadId: job.data.emailOptions.threadId || null,
          hash: emailId,
          status: "sent",
          metadata: {
            subject: job.data.emailOptions.subject,
            userId: job.data.userId,
            sequenceId: job.data.sequenceId,
            contactId: job.data.contactId,
            stepId: job.data.stepId,
          },
          sentAt: new Date(),
        },
      });

      // Create email event
      await prisma.emailEvent.create({
        data: {
          emailId,
          type: "sent",
          sequenceId: job.data.sequenceId,
          contactId: job.data.contactId,
          metadata: {
            stepId: job.data.stepId,
            messageId: response.data.id || "",
            subject: job.data.emailOptions.subject,
            userId: job.data.userId,
          },
        },
      });

      logger.info(`Email sent successfully: ${response.data.id}`);
    } catch (error) {
      if (error instanceof Error) {
        logger.error("Error processing email:", error);

        // Add error cooldown
        await rateLimiter.addCooldown(
          job.data.userId,
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

        // Create error tracking record
        const emailId = randomUUID();
        await prisma.emailTracking.create({
          data: {
            id: emailId,
            hash: emailId,
            status: "failed",
            metadata: {
              subject: job.data.emailOptions.subject,
              userId: job.data.userId,
              sequenceId: job.data.sequenceId,
              contactId: job.data.contactId,
              stepId: job.data.stepId,
              error: error.message,
            },
          },
        });

        // Create error event
        await prisma.emailEvent.create({
          data: {
            emailId,
            type: "error",
            sequenceId: job.data.sequenceId,
            contactId: job.data.contactId,
            metadata: {
              stepId: job.data.stepId,
              error: error.message,
              subject: job.data.emailOptions.subject,
              userId: job.data.userId,
            },
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

        // Create bounce tracking record
        const emailId = randomUUID();
        await prisma.emailTracking.create({
          data: {
            id: emailId,
            messageId,
            hash: emailId,
            status: "bounced",
            metadata: {
              subject: job.data.emailOptions.subject,
              userId: job.data.userId,
              sequenceId: job.data.sequenceId,
              contactId: job.data.contactId,
              stepId: job.data.stepId,
            },
            bounceInfo: {
              name: bounceHeader.name || null,
              value: bounceHeader.value || null,
            },
          },
        });

        // Create bounce event
        await prisma.emailEvent.create({
          data: {
            emailId,
            type: "bounce",
            sequenceId: job.data.sequenceId,
            contactId: job.data.contactId,
            metadata: {
              stepId: job.data.stepId,
              messageId,
              subject: job.data.emailOptions.subject,
              userId: job.data.userId,
            },
          },
        });

        // Add bounce cooldown
        await rateLimiter.addCooldown(
          job.data.userId,
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
