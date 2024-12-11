import { google } from "googleapis";
import { prisma } from "@mailjot/database";
import { randomUUID } from "crypto";
import { logger } from "../logger";
import { addTrackingToEmail } from "../tracking/tracking-service";
import type { EmailJob, GoogleAccount } from "../../types/queue";
import type { EmailTracking, EmailTrackingMetadata } from "@mailjot/types";

export class EmailService {
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

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    threadId?: string;
    tracking: {
      enabled: boolean;
      openTracking: boolean;
      clickTracking: boolean;
      unsubscribeTracking: boolean;
    };
    account: GoogleAccount;
    userId: string;
    sequenceId: string;
    contactId: string;
    stepId: string;
  }): Promise<{ success: boolean; messageId?: string; threadId?: string }> {
    try {
      // Get Gmail client
      const gmail = await this.getGmailClient(options.account);

      // Send tracked version to recipient
      const trackingId = randomUUID();
      const trackingHash = randomUUID();

      const trackingMetadata: EmailTrackingMetadata = {
        email: options.to,
        userId: options.userId,
        sequenceId: options.sequenceId,
        contactId: options.contactId,
        stepId: options.stepId,
      };

      const tracking: EmailTracking = {
        id: trackingId,
        hash: trackingHash,
        type: "tracked",
        wrappedLinks: true,
        metadata: trackingMetadata,
      };

      const trackedContent = await addTrackingToEmail(options.html, tracking);

      // Prepare tracked email
      const trackedEmail = [
        `To: ${options.to}`,
        `Subject: ${options.subject}`,
        "Content-Type: text/html; charset=utf-8",
        options.replyTo ? `Reply-To: ${options.replyTo}` : "",
        "",
        trackedContent,
      ].join("\n");

      const encodedTrackedEmail = Buffer.from(trackedEmail)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send tracked email
      const trackedResponse = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedTrackedEmail,
          threadId: options.threadId,
        },
      });

      // Send untracked version to sender's mailbox
      const untrackedEmail = [
        `To: ${options.account.email}`,
        `Subject: ${options.subject} (Sent)`,
        "Content-Type: text/html; charset=utf-8",
        "",
        options.html,
      ].join("\n");

      const encodedUntrackedEmail = Buffer.from(untrackedEmail)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send untracked email
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedUntrackedEmail,
          labelIds: ["SENT"],
        },
      });

      // Create email tracking record
      const emailId = randomUUID();
      await prisma.emailTracking.create({
        data: {
          id: emailId,
          messageId: trackedResponse.data.id || undefined,
          threadId: options.threadId || undefined,
          hash: emailId,
          status: "sent",
          metadata: {
            email: options.to,
            userId: options.userId,
            sequenceId: options.sequenceId,
            contactId: options.contactId,
            stepId: options.stepId,
          },
          sentAt: new Date(),
        },
      });

      // Create email event
      await prisma.emailEvent.create({
        data: {
          emailId,
          type: "sent",
          sequenceId: options.sequenceId,
          contactId: options.contactId,
          metadata: {
            stepId: options.stepId,
            messageId: trackedResponse.data.id || "",
            userId: options.userId,
          },
        },
      });

      logger.info(`Email sent successfully: ${trackedResponse.data.id}`);

      return {
        success: true,
        messageId: trackedResponse.data.id || undefined,
        threadId: trackedResponse.data.threadId || undefined,
      };
    } catch (error) {
      logger.error("Error sending email:", error);
      throw error;
    }
  }

  async checkBounceStatus(
    messageId: string
  ): Promise<{ bounced: boolean; details?: any }> {
    try {
      // Get message details from database
      const emailTracking = await prisma.emailTracking.findFirst({
        where: { messageId },
      });

      if (!emailTracking || !emailTracking.metadata) {
        throw new Error("Email tracking record not found");
      }

      const metadata = emailTracking.metadata as {
        email: string;
        userId: string;
        sequenceId: string;
        contactId: string;
        stepId: string;
      };

      // Get Gmail client using the user's account
      const account = await prisma.user.findUnique({
        where: { id: metadata.userId },
        include: {
          accounts: {
            where: { provider: "google" },
            take: 1,
          },
        },
      });

      if (!account?.accounts[0]) {
        throw new Error("User's Google account not found");
      }

      const gmail = await this.getGmailClient({
        accessToken: account.accounts[0].access_token || "",
        refreshToken: account.accounts[0].refresh_token || "",
      });

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

        // Update tracking record
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

        // Create bounce event
        await prisma.emailEvent.create({
          data: {
            emailId: emailTracking.id,
            type: "bounce",
            sequenceId: metadata.sequenceId,
            contactId: metadata.contactId,
            metadata: {
              stepId: metadata.stepId,
              messageId,
              userId: metadata.userId,
            },
          },
        });

        return {
          bounced: true,
          details: {
            recipients: bounceHeader.value,
            timestamp: new Date(),
          },
        };
      }

      return { bounced: false };
    } catch (error) {
      logger.error("Error checking bounce status:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
