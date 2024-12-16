import { google } from "googleapis";
import { prisma } from "@mailjot/database";
import { randomUUID } from "crypto";
import { logger } from "../log/logger";
import { addTrackingToEmail } from "../track/tracking-service";
import { updateSequenceStats } from "../stats/sequence-stats-service";
import type { EmailJob } from "../../types/queue";
import type {
  EmailResult,
  EmailTracking,
  EmailTrackingMetadata,
  GoogleAccount,
} from "@mailjot/types";
import type { gmail_v1 } from "googleapis";
import type { SendEmailOptions } from "@mailjot/types";
import { gmailClientService } from "../google/gmail/gmail";
import {
  generateMimeBoundary,
  generateEmailHeaders,
  generateMimeParts,
  convertToPlainText,
  debeaconizeContent,
  processEmailParts,
  generateDebeaconizedId,
  convertToBase64UrlFormat,
  formatSenderInfo,
  splitEmailContent,
  parseMimeBoundary,
} from "../google/smtp/helper";

export class EmailService {
  /**
   * Main function to send an email with tracking and create necessary records
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    try {
      this.logEmailSendStart(options);
      const gmail = await this.getGmailClient(options.userId, options.account);

      // Generate message ID and boundary
      const messageId = `<${randomUUID()}>`;
      const boundary = generateMimeBoundary();

      // Format sender information
      const fromHeader = formatSenderInfo(options.account.email!, "Zee");

      // If threadId exists, fetch the original message headers
      let threadHeaders;
      let originalSubject;
      if (options.threadId) {
        try {
          // Get the thread messages
          const thread = await gmail.users.threads.get({
            userId: "me",
            id: options.threadId,
            format: "full",
          });

          if (thread.data.messages && thread.data.messages.length > 0) {
            // Get the first message in the thread
            const originalMessage = thread.data.messages[0];
            const headers = originalMessage.payload?.headers || [];

            // Get the original message ID and subject
            const originalMessageId = headers.find(
              (h) => h.name?.toLowerCase() === "message-id"
            )?.value;
            originalSubject = headers.find(
              (h) => h.name?.toLowerCase() === "subject"
            )?.value;

            // Collect all message IDs in the thread for References
            const references = thread.data.messages
              .map((msg) => {
                const msgId = msg.payload?.headers?.find(
                  (h) => h.name?.toLowerCase() === "message-id"
                )?.value;
                return msgId ? msgId.replace(/[<>]/g, "") : null;
              })
              .filter(Boolean) as string[];

            threadHeaders = {
              messageId: messageId.replace(/[<>]/g, ""),
              inReplyTo: originalMessageId?.replace(/[<>]/g, ""),
              references: references,
            };

            logger.info({ threadHeaders }, "Thread Headers Retrieved");
          }
        } catch (error) {
          logger.error("Error fetching thread information:", error);
        }
      }

      // Create email headers
      const headers = generateEmailHeaders({
        fromHeader,
        to: options.to,
        subject: options.subject,
        messageId: messageId.replace(/[<>]/g, ""),
        threadId: options.threadId,
        boundary,
        originalSubject: originalSubject || options.subject,
        threadHeaders,
      });

      // Convert HTML to plain text and prepare MIME parts
      const plainText = convertToPlainText(options.html);
      const trackingInfo = this.createTrackingInfo(options);
      const trackedContent = await this.prepareTrackedContent(options);

      const { plainTextPart, senderPart, recipientPart } = generateMimeParts({
        boundary,
        plainText,
        originalContent: options.html,
        content: trackedContent,
      });

      logger.info("🔄 Generated MIME parts");

      // Send tracked email to recipient
      const trackedResponse = await this.sendTrackedEmail(
        gmail,
        options,
        headers,
        plainTextPart,
        recipientPart
      );

      // Wait for Gmail to process the message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send untracked copy to sender with same thread ID
      await this.sendUntrackedCopy(
        gmail,
        options,
        headers,
        plainTextPart,
        senderPart,
        trackedResponse.threadId!,
        trackedResponse.id!
      );

      // Create tracking records
      await this.createEmailRecords(options, trackedResponse);

      this.logEmailSendSuccess(trackedResponse);

      return {
        success: true,
        messageId: trackedResponse.id!,
        threadId: trackedResponse.threadId!,
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
    logger.info("📧 Starting email send process");
  }

  /**
   * Send tracked version of the email
   */
  private async sendTrackedEmail(
    gmail: gmail_v1.Gmail,
    options: SendEmailOptions,
    headers: string,
    plainTextPart: string,
    recipientPart: string
  ): Promise<gmail_v1.Schema$Message> {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
        threadId: options.threadId,
      },
      "📤 Sending tracked email"
    );

    const emailContent = [headers, "", plainTextPart, recipientPart].join(
      "\r\n"
    );
    const encodedEmail = convertToBase64UrlFormat(emailContent);

    // Log the headers for debugging
    logger.debug("Email Headers for tracked email:", {
      headers: headers.split("\r\n"),
      threadId: options.threadId,
    });

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
   * Insert untracked copy to sender's sent folder with proper headers and content
   */
  private async sendUntrackedCopy(
    gmail: gmail_v1.Gmail,
    options: SendEmailOptions,
    headers: string,
    plainTextPart: string,
    senderPart: string,
    threadId: string,
    messageId: string
  ): Promise<void> {
    try {
      logger.info("Preparing untracked copy for sender's sent folder");

      // Wait a bit for the original message to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get the original message to maintain headers and structure
      const originalMessage = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      if (!originalMessage.data.payload?.headers) {
        throw new Error("Could not get original message headers");
      }

      // Get the original headers
      const originalHeaders = originalMessage.data.payload.headers;
      const messageIdHeader = originalHeaders.find(
        (h) => h.name?.toLowerCase() === "message-id"
      )?.value;
      const inReplyToHeader = originalHeaders.find(
        (h) => h.name?.toLowerCase() === "in-reply-to"
      )?.value;
      const referencesHeader = originalHeaders.find(
        (h) => h.name?.toLowerCase() === "references"
      )?.value;

      // Create new email content with the same threading headers
      const emailContent = [
        headers, // Use the same headers as the tracked email
        "",
        plainTextPart,
        senderPart,
      ].join("\r\n");

      // Log the headers for debugging
      logger.debug("Email Headers for untracked copy:", {
        originalMessageId: messageIdHeader,
        originalInReplyTo: inReplyToHeader,
        originalReferences: referencesHeader,
        threadId,
      });

      const base64EncodedEmail = convertToBase64UrlFormat(emailContent);

      logger.info(
        {
          to: options.account.email,
          subject: options.subject,
          threadId,
        },
        "📤 Inserting untracked copy to sent folder"
      );

      // Insert the untracked version with original headers
      const { data } = await gmail.users.messages.insert({
        userId: "me",
        requestBody: {
          raw: base64EncodedEmail,
          threadId,
          labelIds: ["SENT"],
        },
      });

      logger.info(
        {
          messageId: data.id,
          threadId: data.threadId,
        },
        "✅ Untracked copy added to sent folder"
      );

      // Delete the original tracked message from sent folder
      try {
        await gmail.users.messages.delete({
          userId: "me",
          id: messageId,
        });
        logger.info("✅ Original tracked message deleted from sent folder");
      } catch (err) {
        logger.error("Error deleting original tracked message:", err);
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          threadId,
          to: options.account.email,
          subject: options.subject,
        },
        "❌ Failed to insert untracked copy"
      );
      throw error;
    }
  }

  /**
   * Create tracking information for the email
   */
  private createTrackingInfo(options: SendEmailOptions): {
    trackingId: string;
    trackingHash: string;
    trackingMetadata: EmailTrackingMetadata;
  } {
    const trackingId = randomUUID();
    const trackingHash = randomUUID();

    logger.info("📝 Creating tracking metadata");

    const trackingMetadata: EmailTrackingMetadata = {
      email: options.to,
      userId: options.userId,
      sequenceId: options.sequenceId,
      contactId: options.contactId,
      stepId: options.stepId,
    };

    logger.info(trackingId, "📊 Created tracking object");

    return { trackingId, trackingHash, trackingMetadata };
  }

  /**
   * Prepare tracked content with tracking information
   */
  private async prepareTrackedContent(
    options: SendEmailOptions
    // tracking: EmailTracking
    // trackingId: string,
    // trackingHash: string,
    // trackingMetadata: EmailTrackingMetadata
  ): Promise<string> {
    logger.info("🔄 Adding tracking to email content");

    return addTrackingToEmail(options.html, options.tracking);
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
    logger.info("📝 Creating email tracking record");

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

    // Create the email event
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

    // Update sequence stats for the sent event
    if (options.sequenceId && options.contactId) {
      await updateSequenceStats(options.sequenceId, "sent", options.contactId);
    }

    logger.info("✅ Email event and stats created");
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
