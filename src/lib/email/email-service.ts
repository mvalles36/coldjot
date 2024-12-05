import { google } from "googleapis";
import { sendGmailSMTP } from "@/lib/smtp/gmail";
import type {
  CreateDraftOptions,
  EmailResponse,
  SendDraftOptions,
  SendEmailOptions,
} from "@/types";

import type { EmailTracking } from "@/types/sequences";
import type { GoogleAccount } from "@/lib/google/google-account";

import { encode as base64Encode } from "js-base64";
import {
  getSenderInfo,
  getThreadInfo,
  createEmailMessage,
  createUntrackedMessage,
} from "./helper";

// Add flag to test SMTP approach
const USE_SMTP_DUAL_DELIVERY = process.env.USE_SMTP_DUAL_DELIVERY === "true";

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

import {
  updateTrackingEvent,
  updateSequenceContact,
  createOrGetEmailThread,
  trackEmailSent,
  trackEmailBounce,
  handleTokenRefresh,
} from "./helper";

import { addTrackingToEmail } from "@/lib/tracking/tracking-service";

/**
 * Main function to handle email sending with tracking and error handling
 */
export async function handleEmailSend(
  emailOptions: SendEmailOptions,
  tracking: EmailTracking,
  account: GoogleAccount
): Promise<string | undefined> {
  try {
    // Add tracking pixel and wrap links
    const trackedContent = await addTrackingToEmail(
      emailOptions.content,
      tracking
    );

    // Send the email
    const result = await sendEmail({
      ...emailOptions,
      content: trackedContent,
      originalContent: emailOptions.content,
      accessToken: account.access_token,
    });

    // Update tracking and thread information
    await updateTrackingEvent(tracking, result);

    if (result.threadId) {
      await updateSequenceContact(tracking, result.threadId);
      await createOrGetEmailThread(tracking, result, emailOptions.subject);
    }

    // Track the sent event
    await trackEmailSent(tracking, result, emailOptions.to);

    console.log(`Email sent with tracking:`, {
      email: emailOptions.to,
      messageId: result.messageId,
      threadId: result.threadId,
      type: tracking.type,
    });

    return result.threadId;
  } catch (error: any) {
    if (error.message === "TOKEN_EXPIRED") {
      const retryResult = await handleTokenRefresh(account, emailOptions);
      return retryResult.threadId;
    } else {
      await trackEmailBounce(tracking, error, emailOptions.to);
      console.error(`❌ Error sending email:`, error);
      throw error;
    }
  }
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export async function sendEmail({
  to,
  subject,
  content,
  threadId,
  accessToken,
  originalContent,
}: SendEmailOptions): Promise<EmailResponse> {
  try {
    if (accessToken && !USE_SMTP_DUAL_DELIVERY) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken,
        token_type: "Bearer",
      });

      const gmail = google.gmail({ version: "v1", auth });
      const senderInfo = await getSenderInfo(accessToken);
      const { threadHeaders, originalSubject } = await getThreadInfo(
        gmail,
        threadId
      );

      // Send tracked version to recipient
      const encodedMessage = createEmailMessage({
        fromHeader: senderInfo.header,
        to,
        subject,
        content,
        threadId,
        originalSubject,
        threadHeaders,
      });

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
          threadId: threadId || undefined,
        },
      });

      // Insert untracked version in sender's mailbox
      if (originalContent && response.data.id) {
        const encodedUntrackedMessage = await createUntrackedMessage({
          gmail,
          messageId: response.data.id,
          to,
          subject,
          originalContent,
          threadId,
          originalSubject,
          threadHeaders,
        });

        await gmail.users.messages.insert({
          userId: "me",
          requestBody: {
            raw: encodedUntrackedMessage,
            threadId: response.data.threadId || undefined,
            labelIds: ["SENT"],
          },
        });
      }

      return {
        messageId: response.data.id || "",
        threadId: response.data.threadId || undefined,
      };
    } else {
      const email = await sendGmailSMTP({
        to,
        subject,
        content,
        threadId,
        originalContent,
        accessToken,
      });

      return {
        ...email,
      };
    }
  } catch (error: any) {
    if (
      error.status === 401 ||
      (error.responseCode === 535 && error.command === "AUTH XOAUTH2")
    ) {
      throw new Error("TOKEN_EXPIRED");
    }
    console.error("Error sending email:", error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export async function createDraft({
  accessToken,
  to,
  subject,
  content,
}: CreateDraftOptions) {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: accessToken,
      token_type: "Bearer",
    });

    const gmail = google.gmail({ version: "v1", auth });

    const message = [
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
      `To: ${to}`,
      `Subject: ${subject}`,
      "",
      content,
    ].join("\n");

    const encodedMessage = base64Encode(message)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedMessage,
        },
      },
    });

    return response.data.id;
  } catch (error: any) {
    if (error.status === 401) {
      throw new Error("TOKEN_EXPIRED");
    }
    console.error("Error creating draft:", error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export async function sendDraft({ accessToken, draftId }: SendDraftOptions) {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: accessToken,
      token_type: "Bearer",
    });

    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.drafts.send({
      userId: "me",
      requestBody: {
        id: draftId,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error sending draft:", error);
    throw error;
  }
}
