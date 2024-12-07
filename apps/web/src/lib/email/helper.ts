import { encode as base64Encode } from "js-base64";
import { prisma } from "@mailjot/database";
import { generateMessageId, normalizeSubject } from "@/utils";
import type { EmailResult, ThreadHeaders } from "@/types";
import { sendEmail } from "@/lib/email/email-service";
import { refreshAccessToken } from "@/lib/google/google-account";
import type { SendEmailOptions } from "@/types";
import type { EmailTracking } from "@/types/sequences";
import { trackEmailEvent } from "@/lib/tracking/tracking-service";
import type { GoogleAccount } from "@/lib/google/google-account";

interface SenderInfo {
  email: string;
  name?: string;
  header: string;
}

interface MessageHeader {
  name?: string;
  value?: string;
}

interface GmailMessage {
  payload?: {
    headers?: MessageHeader[];
  };
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export async function getSenderInfo(accessToken: string): Promise<SenderInfo> {
  const account = await prisma.account.findFirst({
    where: { access_token: accessToken },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  if (!account?.user?.email) {
    throw new Error("User email not found");
  }

  const senderEmail = account.user.email;
  const senderName = account.user.name;
  const header = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  return {
    email: senderEmail,
    name: senderName || undefined,
    header,
  };
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export async function getThreadInfo(
  gmail: any,
  threadId: string | undefined
): Promise<{
  threadHeaders: ThreadHeaders;
  originalSubject?: string;
}> {
  let threadHeaders: ThreadHeaders = {
    messageId: generateMessageId(),
  };
  let originalSubject: string | undefined;

  if (!threadId) {
    return { threadHeaders };
  }

  try {
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["Message-ID", "References", "In-Reply-To", "Subject"],
    });

    if (thread.data.messages && thread.data.messages.length > 0) {
      const messages = thread.data.messages as GmailMessage[];
      const firstMessage = messages[0];
      const firstMessageHeaders = firstMessage.payload?.headers || [];
      const rawOriginalSubject = firstMessageHeaders.find(
        (h: MessageHeader) => h.name?.toLowerCase() === "subject"
      )?.value;

      if (rawOriginalSubject) {
        originalSubject = rawOriginalSubject.replace(
          /=\?UTF-8\?B\?(.*?)\?=/g,
          (_match: string, p1: string) =>
            Buffer.from(p1, "base64").toString("utf8")
        );
      }

      const lastMessage = messages[messages.length - 1];
      const headers = lastMessage.payload?.headers || [];

      const lastMessageId = headers.find(
        (h: MessageHeader) => h.name?.toLowerCase() === "message-id"
      )?.value;

      const references = messages
        .map((msg: GmailMessage) => {
          const msgIdHeader = msg.payload?.headers?.find(
            (h: MessageHeader) => h.name?.toLowerCase() === "message-id"
          );
          return msgIdHeader?.value || "";
        })
        .filter(Boolean);

      threadHeaders = {
        messageId: threadHeaders.messageId,
        inReplyTo: lastMessageId || undefined,
        references: references,
      };
    }
  } catch (error) {
    console.error("Error getting thread details:", error);
  }

  return { threadHeaders, originalSubject };
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export function createEmailMessage({
  fromHeader,
  to,
  subject,
  content,
  threadId,
  originalSubject,
  threadHeaders,
}: {
  fromHeader: string;
  to: string;
  subject: string;
  content: string;
  threadId?: string;
  originalSubject?: string;
  threadHeaders: ThreadHeaders;
}): string {
  const message = [
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${normalizeSubject(subject, !!threadId, originalSubject)}`,
    `Message-ID: <${threadHeaders.messageId}>`,
    ...(threadHeaders.inReplyTo
      ? [`In-Reply-To: ${threadHeaders.inReplyTo}`]
      : []),
    ...(threadHeaders.references?.length
      ? [`References: ${threadHeaders.references.join(" ")}`]
      : []),
    "",
    content,
  ].join("\n");

  return base64Encode(message)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export async function createUntrackedMessage({
  gmail,
  messageId,
  to,
  subject,
  originalContent,
  threadId,
  originalSubject,
  threadHeaders,
}: {
  gmail: any;
  messageId: string;
  to: string;
  subject: string;
  originalContent: string;
  threadId?: string;
  originalSubject?: string;
  threadHeaders: ThreadHeaders;
}): Promise<string> {
  const sentMessage = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = sentMessage.data.payload?.headers || [];
  const from =
    headers.find((h: MessageHeader) => h.name?.toLowerCase() === "from")
      ?.value || "";
  const date =
    headers.find((h: MessageHeader) => h.name?.toLowerCase() === "date")
      ?.value || "";

  const untrackedMessage = [
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `From: ${from}`,
    `Date: ${date}`,
    `To: ${to}`,
    `Subject: ${normalizeSubject(subject, !!threadId, originalSubject)}`,
    `Message-ID: <${threadHeaders.messageId}>`,
    ...(threadHeaders.inReplyTo
      ? [`In-Reply-To: ${threadHeaders.inReplyTo}`]
      : []),
    ...(threadHeaders.references?.length
      ? [`References: ${threadHeaders.references.join(" ")}`]
      : []),
    "",
    originalContent,
  ].join("\n");

  return base64Encode(untrackedMessage)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

/**
 * Update tracking event with message and thread IDs
 */
export const updateTrackingEvent = async (
  tracking: EmailTracking,
  result: EmailResult
) => {
  if (!result.messageId) return;

  await prisma.emailTrackingEvent.update({
    where: { hash: tracking.hash },
    data: {
      messageId: result.messageId,
      gmailThreadId: result.threadId,
    },
  });
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

/**
 * Update sequence contact with thread ID
 */
export const updateSequenceContact = async (
  tracking: EmailTracking,
  threadId: string
) => {
  await prisma.sequenceContact.update({
    where: {
      sequenceId_contactId: {
        sequenceId: tracking.metadata.sequenceId,
        contactId: tracking.metadata.contactId,
      },
    },
    data: {
      threadId,
    },
  });
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

/**
 * Create or get email thread
 */
export const createOrGetEmailThread = async (
  tracking: EmailTracking,
  result: EmailResult,
  subject: string
) => {
  if (!result.threadId) return;

  const existingThread = await prisma.emailThread.findUnique({
    where: {
      gmailThreadId: result.threadId,
    },
  });

  if (!existingThread) {
    await prisma.emailThread.create({
      data: {
        gmailThreadId: result.threadId,
        sequenceId: tracking.metadata.sequenceId,
        contactId: tracking.metadata.contactId,
        userId: tracking.metadata.userId,
        subject,
        firstMessageId: result.messageId,
      },
    });
  }
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

/**
 * Track email sent event
 */
export const trackEmailSent = async (
  tracking: EmailTracking,
  result: EmailResult,
  recipientEmail: string
) => {
  await trackEmailEvent(
    tracking.id,
    "sent",
    {
      messageId: result.messageId,
      threadId: result.threadId,
    },
    {
      sequenceId: tracking.metadata.sequenceId,
      email: recipientEmail,
      userId: tracking.metadata.userId,
      stepId: tracking.metadata.stepId,
      contactId: tracking.metadata.contactId,
    }
  );
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

/**
 * Track email bounce event
 */
export const trackEmailBounce = async (
  tracking: EmailTracking,
  error: Error,
  recipientEmail: string
) => {
  await trackEmailEvent(
    tracking.id,
    "bounced",
    {
      bounceReason: error.message,
    },
    {
      sequenceId: tracking.metadata.sequenceId,
      email: recipientEmail,
      userId: tracking.metadata.userId,
      stepId: tracking.metadata.stepId,
      contactId: tracking.metadata.contactId,
    }
  );
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

/**
 * Handle token refresh and retry sending email
 */
export const handleTokenRefresh = async (
  account: GoogleAccount,
  emailOptions: SendEmailOptions
): Promise<EmailResult> => {
  console.log(`🔄 Refreshing access token...`);
  const newAccessToken = await refreshAccessToken(
    account.userId,
    account.refresh_token
  );

  if (!newAccessToken) {
    throw new Error("Failed to refresh token");
  }

  console.log(`🔄 Retrying with new token...`);
  const retryResult = await sendEmail({
    ...emailOptions,
    content: emailOptions.content,
    accessToken: newAccessToken,
    originalContent: emailOptions.content,
  });

  if (retryResult.threadId) {
    console.log(
      `📧 Email sent successfully in thread: ${retryResult.threadId}`
    );
  } else {
    console.log(
      `📧 New email thread created with ID: ${retryResult.messageId}`
    );
  }

  return retryResult;
};
