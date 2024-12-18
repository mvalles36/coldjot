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
import fs from "fs";
import path from "path";

import {
  getSenderInfo,
  getSenderInfoWithId,
  createEmailMessage,
  createUntrackedMessage,
  logEmailHeadersToFile,
} from "./helper";

import { getEmailThreadInfo } from "@/services/google/helper";

import { sendGmailSMTP } from "@/services/google/smtp/gmail";

export class EmailService {
  private readonly logsDir = "email_logs";

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  constructor() {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * Main function to send an email with tracking and create necessary records
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailResult> {
    try {
      const useApi = true;
      if (useApi) {
        logger.info("📧 Starting email send process");

        const gmail = await gmailClientService.getClient(options.userId);

        // Get sender info using accessToken like SMTP version
        const senderInfo = await getSenderInfoWithId(options.userId);

        // Get thread info exactly like SMTP version
        const { threadHeaders, originalSubject } = await getEmailThreadInfo(
          gmail,
          options.threadId
        );

        // Log thread info to file
        logEmailHeadersToFile(
          "thread_info",
          {
            threadHeaders,
            originalSubject,
            threadId: options.threadId,
          },
          threadHeaders.messageId,
          options.threadId
        );

        // Create tracked version for recipient
        const trackedContent = await addTrackingToEmail(
          options.html,
          options.tracking
        );

        // Create message with proper thread headers - exactly like SMTP version
        const encodedMessage = createEmailMessage({
          fromHeader: senderInfo.header,
          to: options.to,
          subject: options.subject,
          content: trackedContent,
          threadId: options.threadId,
          originalSubject: originalSubject || options.subject,
          threadHeaders,
        });

        // Log tracked message headers
        logEmailHeadersToFile(
          "tracked_message",
          {
            fromHeader: senderInfo.header,
            to: options.to,
            subject: options.subject,
            threadId: options.threadId,
            originalSubject,
            threadHeaders,
          },
          threadHeaders.messageId,
          options.threadId
        );

        const response = await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: encodedMessage,
            threadId: options.threadId || undefined,
          },
        });

        // Wait for Gmail to process the message and get the actual Message-ID
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Get the sent message to ensure we have the correct Gmail-generated Message-ID
        const sentMessage = await gmail.users.messages.get({
          userId: "me",
          id: response.data.id!,
          format: "full",
        });

        // Extract the Gmail-generated Message-ID and Subject from headers
        const sentMessageHeaders = sentMessage.data.payload?.headers || [];
        const gmailMessageId = sentMessageHeaders.find(
          (h) => h.name?.toLowerCase() === "message-id"
        )?.value;
        const sentSubject = sentMessageHeaders.find(
          (h) => h.name?.toLowerCase() === "subject"
        )?.value;

        // Update threadHeaders with the actual Gmail-generated Message-ID
        if (gmailMessageId) {
          threadHeaders.messageId = gmailMessageId;
        }

        // Log sent message response
        logEmailHeadersToFile(
          "sent_message_response",
          {
            messageId: response.data.id,
            threadId: response.data.threadId,
            labelIds: response.data.labelIds,
          },
          response.data.id!,
          response.data.threadId!
        );

        // Create untracked version for sender's sent folder
        if (options.html && response.data.id) {
          // Get the sent message to ensure we have the correct thread ID and Message-ID
          const sentMessage = await gmail.users.messages.get({
            userId: "me",
            id: response.data.id,
            format: "full",
          });

          // Get the actual Gmail-generated Message-ID
          const messageIdHeader = sentMessage.data.payload?.headers?.find(
            (h) => h.name?.toLowerCase() === "message-id"
          )?.value;

          // Update threadHeaders with the actual Gmail Message-ID
          if (messageIdHeader) {
            threadHeaders.messageId = messageIdHeader;
          }

          const encodedUntrackedMessage = await createUntrackedMessage({
            gmail,
            messageId: response.data.id,
            to: options.to,
            subject: sentSubject || options.subject,
            originalContent: options.html,
            threadId: sentMessage.data.threadId || undefined,
            originalSubject: originalSubject || options.subject,
            threadHeaders,
          });

          // Log untracked message headers
          logEmailHeadersToFile(
            "untracked_message",
            {
              to: options.to,
              subject: sentSubject || options.subject,
              threadId: sentMessage.data.threadId,
              originalSubject,
              threadHeaders,
            },
            response.data.id!,
            sentMessage.data.threadId!
          );

          // Insert untracked version in sender's sent folder
          const untrackedResponse = await gmail.users.messages.insert({
            userId: "me",
            requestBody: {
              raw: encodedUntrackedMessage,
              threadId: sentMessage.data.threadId || undefined,
              labelIds: ["SENT"],
            },
          });

          // Log untracked insert response
          logEmailHeadersToFile(
            "untracked_insert_response",
            {
              messageId: untrackedResponse.data.id,
              threadId: untrackedResponse.data.threadId,
              labelIds: untrackedResponse.data.labelIds,
            },
            untrackedResponse.data.id!,
            untrackedResponse.data.threadId!
          );

          // Delete the original tracked message from sent folder
          try {
            await gmail.users.messages.delete({
              userId: "me",
              id: response.data.id,
            });
            logger.info("✅ Original tracked message deleted from sent folder");
          } catch (err) {
            logger.error("Error deleting original tracked message:", err);
          }
        }

        // Create tracking records
        // TODO : The emailId should be the messageId or something else
        const emailId = randomUUID();
        await this.createEmailTrackingRecord(emailId, options, response.data);
        await this.createEmailEvent(emailId, options, response.data);

        logger.info(
          `✨ Email sending process completed successfully ${response.data.id} --- ${response.data.threadId}`
        );

        return {
          success: true,
          messageId: response.data.id!,
          threadId: response.data.threadId!,
        };
      } else {
        // Fallback to SMTP version
        const trackedContent = await addTrackingToEmail(
          options.html,
          options.tracking
        );
        const email = await sendGmailSMTP({
          to: options.to,
          subject: options.subject,
          content: trackedContent,
          threadId: options.threadId,
          originalContent: options.html,
          accessToken: options.account.accessToken!,
        });

        return {
          messageId: email.messageId,
          threadId: email.threadId || "",
          success: true,
        };
      }
    } catch (error: any) {
      // Log error details
      logEmailHeadersToFile(
        "error",
        {
          error: error.message,
          stack: error.stack,
          options: {
            to: options.to,
            subject: options.subject,
            threadId: options.threadId,
          },
        },
        randomUUID(),
        options.threadId
      );

      if (
        error.status === 401 ||
        (error.responseCode === 535 && error.command === "AUTH XOAUTH2")
      ) {
        throw new Error("TOKEN_EXPIRED");
      }
      await this.handleSendEmailError(error, options);
      throw error;
    }
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * @deprecated This method will be removed in the next major release.
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
    const encodedEmail = this.encodeEmail(emailContent);

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
      `✅ Tracked email sent successfully ${data.id} --- ${data.threadId}`
    );

    return data;
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * @deprecated This method will be removed in the next major release.
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

      const base64EncodedEmail = this.encodeEmail(emailContent);

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

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * @deprecated This method will be removed in the next major release.
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

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * @deprecated This method will be removed in the next major release.
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

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

  /**
   * @deprecated This method will be removed in the next major release.
   */
  private encodeEmail(content: string): string {
    return Buffer.from(content)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

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

  // -----------------------------------------

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

  // -----------------------------------------
  // -----------------------------------------
  // -----------------------------------------

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
      "��� Error sending email"
    );
  }
}

export const emailService = new EmailService();
