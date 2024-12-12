import { google } from "googleapis";
import { prisma } from "@mailjot/database";
import { randomUUID } from "crypto";
import { logger } from "../log/logger";
import { addTrackingToEmail } from "../track/tracking-service";
import type { EmailJob } from "../../types/queue";
import type {
  EmailTracking,
  EmailTrackingMetadata,
  GoogleAccount,
} from "@mailjot/types";
import type { gmail_v1 } from "googleapis";
import type { SendEmailOptions } from "@mailjot/types";
import { gmailClientService } from "../google/gmail/gmail";

export class EmailService {
  /**
   * Main function to send an email with tracking and create necessary records
   */
  async sendEmail(
    options: SendEmailOptions
  ): Promise<{ success: boolean; messageId?: string; threadId?: string }> {
    try {
      this.logEmailSendStart(options);
      const gmail = await this.getGmailClient(options.userId, options.account);

      // Send tracked email and get response
      const trackedResponse = await this.sendTrackedEmail(gmail, options);

      // Send untracked copy to sender
      await this.sendUntrackedCopy(gmail, options);

      // Create tracking records
      await this.createEmailRecords(options, trackedResponse);

      this.logEmailSendSuccess(trackedResponse);

      return {
        success: true,
        messageId: trackedResponse.id || undefined,
        threadId: trackedResponse.threadId || undefined,
      };
    } catch (error) {
      await this.handleSendEmailError(error, options);
      throw error;
    }
  }

  /**
   * Get an authenticated Gmail client using the new GmailClientService
   */
  private async getGmailClient(
    userId: string,
    account: GoogleAccount
  ): Promise<gmail_v1.Gmail> {
    try {
      return await gmailClientService.getClient(userId);
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          account: {
            email: account.email || "unknown",
            hasAccessToken: !!account.accessToken,
            hasRefreshToken: !!account.refreshToken,
            expiryDate: account.expiryDate
              ? new Date(account.expiryDate).toISOString()
              : "unknown",
          },
        },
        "❌ Failed to initialize Gmail client"
      );
      throw error;
    }
  }

  /**
   * Log the start of email sending process
   */
  private logEmailSendStart(options: SendEmailOptions): void {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
        threadId: options.threadId,
        account: {
          email: options.account.email,
          expiryDate: new Date(options.account.expiryDate!).toISOString(),
        },
      },
      "📧 Starting email send process"
    );

    logger.info(
      {
        email: options.account.email,
      },
      "🔄 Getting Gmail client"
    );
  }

  /**
   * Create and send tracked version of the email
   */
  private async sendTrackedEmail(
    gmail: gmail_v1.Gmail,
    options: SendEmailOptions
  ): Promise<gmail_v1.Schema$Message> {
    const { trackingId, trackingHash, trackingMetadata } =
      this.createTrackingInfo(options);
    const trackedContent = await this.prepareTrackedContent(
      options,
      trackingId,
      trackingHash,
      trackingMetadata
    );
    const encodedEmail = this.encodeEmail(
      this.createEmailContent(
        options.to,
        options.subject,
        trackedContent,
        options.replyTo
      )
    );

    logger.info(
      {
        to: options.to,
        subject: options.subject,
        threadId: options.threadId,
      },
      "📤 Sending tracked email"
    );

    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
        threadId: options.threadId,
      },
    });

    logger.info(
      {
        messageId: data.id,
        threadId: data.threadId,
      },
      "✅ Tracked email sent successfully"
    );

    return data;
  }

  /**
   * Create tracking information for the email
   */
  private createTrackingInfo(options: SendEmailOptions) {
    const trackingId = randomUUID();
    const trackingHash = randomUUID();

    logger.info(
      {
        trackingId,
        trackingHash,
        to: options.to,
      },
      "📝 Creating tracking metadata"
    );

    const trackingMetadata: EmailTrackingMetadata = {
      email: options.to,
      userId: options.userId,
      sequenceId: options.sequenceId,
      contactId: options.contactId,
      stepId: options.stepId,
    };

    logger.info(
      {
        tracking: {
          id: trackingId,
          hash: trackingHash,
          type: "tracked",
          wrappedLinks: true,
          metadata: trackingMetadata,
        },
      },
      "📊 Created tracking object"
    );

    return { trackingId, trackingHash, trackingMetadata };
  }

  /**
   * Prepare tracked content with tracking information
   */
  private async prepareTrackedContent(
    options: SendEmailOptions,
    trackingId: string,
    trackingHash: string,
    trackingMetadata: EmailTrackingMetadata
  ): Promise<string> {
    logger.info("🔄 Adding tracking to email content");

    return addTrackingToEmail(options.html, {
      id: trackingId,
      hash: trackingHash,
      type: "tracked",
      wrappedLinks: true,
      metadata: trackingMetadata,
    });
  }

  /**
   * Create email content with headers
   */
  private createEmailContent(
    to: string,
    subject: string,
    content: string,
    replyTo?: string
  ): string {
    return [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/html; charset=utf-8",
      replyTo ? `Reply-To: ${replyTo}` : "",
      "",
      content,
    ].join("\n");
  }

  /**
   * Encode email content to base64url format
   */
  private encodeEmail(content: string): string {
    return Buffer.from(content)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  /**
   * Send untracked copy of the email to sender
   */
  private async sendUntrackedCopy(
    gmail: gmail_v1.Gmail,
    options: SendEmailOptions
  ): Promise<void> {
    logger.info("📝 Preparing untracked copy for sender");

    const untrackedContent = this.createEmailContent(
      options.account.email!,
      options.subject,
      options.html
    );

    const encodedEmail = this.encodeEmail(untrackedContent);

    logger.info(
      {
        to: options.account.email,
        subject: `${options.subject} (Sent)`,
      },
      "📤 Sending untracked copy to sender"
    );

    const { data } = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
        labelIds: ["SENT"],
      },
    });

    logger.info(
      {
        messageId: data.id,
      },
      "✅ Untracked copy sent successfully"
    );
  }

  /**
   * Create email tracking and event records
   */
  private async createEmailRecords(
    options: SendEmailOptions,
    trackedResponse: gmail_v1.Schema$Message
  ): Promise<void> {
    const emailId = randomUUID();
    await this.createEmailTrackingRecord(emailId, options, trackedResponse);
    await this.createEmailEvent(emailId, options, trackedResponse);
  }

  /**
   * Create email tracking record
   */
  private async createEmailTrackingRecord(
    emailId: string,
    options: SendEmailOptions,
    trackedResponse: gmail_v1.Schema$Message
  ): Promise<void> {
    logger.info(
      {
        emailId,
        messageId: trackedResponse.id,
        threadId: options.threadId,
      },
      "📝 Creating email tracking record"
    );

    await prisma.emailTracking.create({
      data: {
        id: emailId,
        messageId: trackedResponse.id || undefined,
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

    logger.info("✅ Email tracking record created");
  }

  /**
   * Create email event record
   */
  private async createEmailEvent(
    emailId: string,
    options: SendEmailOptions,
    trackedResponse: gmail_v1.Schema$Message
  ): Promise<void> {
    logger.info("📝 Creating email event");

    await prisma.emailEvent.create({
      data: {
        emailId,
        type: "sent",
        sequenceId: options.sequenceId,
        contactId: options.contactId,
        metadata: {
          stepId: options.stepId,
          messageId: trackedResponse.id || "",
          userId: options.userId,
        },
      },
    });

    logger.info("✅ Email event created");
  }

  /**
   * Log successful email send completion
   */
  private logEmailSendSuccess(trackedResponse: gmail_v1.Schema$Message): void {
    logger.info(
      {
        messageId: trackedResponse.id,
        threadId: trackedResponse.threadId,
      },
      "✨ Email sending process completed successfully"
    );
  }

  /**
   * Handle errors during email sending process
   */
  private async handleSendEmailError(
    error: unknown,
    options: SendEmailOptions
  ): Promise<void> {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        options: {
          to: options.to,
          subject: options.subject,
          threadId: options.threadId,
          account: {
            email: options.account.email,
            expiryDate: new Date(options.account.expiryDate!).toISOString(),
          },
        },
      },
      "❌ Error sending email"
    );
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

      const gmail = await this.getGmailClient(metadata.userId, {
        accessToken: account.accounts[0].access_token || "",
        refreshToken: account.accounts[0].refresh_token || "",
        email: account.email || "",
        expiryDate: Number(account.accounts[0].expires_at) || 0,
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
