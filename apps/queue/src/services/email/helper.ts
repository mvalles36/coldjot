import { encode as base64Encode } from "js-base64";
import { prisma } from "@mailjot/database";
import { generateMessageId, normalizeSubject } from "@/utils";
import type { EmailResult, ThreadHeaders } from "@mailjot/types";
// import { sendEmail } from "./email-service";
import { refreshAccessToken } from "@/services/google/account/google-account";
import type { SendEmailOptions } from "@mailjot/types";
import type { EmailTracking } from "@mailjot/types";
import { trackEmailEvent } from "@/services/track/tracking-service";
import type { GoogleAccount } from "@/services/google/account/google-account";
import path from "path";
import { logger } from "../log/logger";

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

export async function getSenderInfoWithId(id: string): Promise<SenderInfo> {
  const account = await prisma.user.findFirst({
    where: { id: id },
    include: {
      accounts: {},
    },
  });

  if (!account?.accounts[0]?.access_token) {
    throw new Error("User email not found");
  }

  const senderEmail = account.email;
  const senderName = account.name;
  const header = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  return {
    email: senderEmail!,
    name: senderName || undefined,
    header: header!,
  };
}

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

export async function getThreadInfo(
  gmail: any,
  threadId: string | undefined
): Promise<{
  threadHeaders: ThreadHeaders;
  originalSubject?: string;
}> {
  let threadHeaders: ThreadHeaders = {
    messageId: generateMessageId().replace(/@[^>]+>$/, "@mail.gmail.com>"),
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

      // Get the last message we're replying to
      const lastMessage = messages[messages.length - 1];
      const lastMessageHeaders = lastMessage.payload?.headers || [];

      // Get the Message-ID of the last message to use as In-Reply-To
      const lastMessageId = lastMessageHeaders.find(
        (h: MessageHeader) => h.name?.toLowerCase() === "message-id"
      )?.value;

      // Build References chain by collecting all Message-IDs in order
      const references = messages
        .map((msg: GmailMessage) => {
          const msgIdHeader = msg.payload?.headers?.find(
            (h: MessageHeader) => h.name?.toLowerCase() === "message-id"
          );
          return msgIdHeader?.value;
        })
        .filter(Boolean) as string[];

      // Get existing References from the last message
      const existingReferences = lastMessageHeaders
        .find((h: MessageHeader) => h.name?.toLowerCase() === "references")
        ?.value?.split(/\s+/)
        .filter(Boolean);

      // Combine existing references with new ones, maintaining order and removing duplicates
      const allReferences = [
        ...new Set([...(existingReferences || []), ...references]),
      ];

      // Ensure all Message-IDs have proper Gmail format
      const formattedReferences = allReferences.map((ref) =>
        ref.includes("@mail.gmail.com")
          ? ref
          : ref.replace(/@[^>]+>$/, "@mail.gmail.com>")
      );

      threadHeaders = {
        messageId: generateMessageId().replace(/@[^>]+>$/, "@mail.gmail.com>"),
        inReplyTo: lastMessageId,
        references: formattedReferences,
      };
    }
  } catch (error) {
    console.error("Error getting thread details:", error);
  }

  return { threadHeaders, originalSubject };
}

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

  // Get the actual Message-ID and Subject from the sent message
  const actualMessageId = headers.find(
    (h: MessageHeader) => h.name?.toLowerCase() === "message-id"
  )?.value;
  const actualSubject = headers.find(
    (h: MessageHeader) => h.name?.toLowerCase() === "subject"
  )?.value;

  const untrackedMessage = [
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `From: ${from}`,
    `Date: ${date}`,
    `To: ${to}`,
    `Subject: ${actualSubject || subject}`, // Use the actual sent subject
    `Message-ID: ${actualMessageId || threadHeaders.messageId}`,
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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

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

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

export const logEmailHeadersToFile = (
  stage: string,
  headers: any,
  messageId: string,
  threadId?: string
): void => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Create a sequence map for the stages
    const stageSequence = {
      thread_info: "01",
      tracked_message: "02",
      sent_message_response: "03",
      sent_message_details: "04",
      untracked_message: "05",
      untracked_insert_response: "06",
      error: "99",
    };

    const sequenceNumber =
      stageSequence[stage as keyof typeof stageSequence] || "00";

    const logsDir = "email_logs";
    const filename = path.join(
      logsDir,
      `${timestamp}_${sequenceNumber}_${stage}.txt`
    );

    const logContent = [
      `Timestamp: ${new Date().toISOString()}`,
      `Stage: ${stage} (${sequenceNumber})`,
      `Message ID: ${messageId}`,
      `Thread ID: ${threadId || "N/A"}`,
      "\nHeaders:",
      JSON.stringify(headers, null, 2),
      "\n-------------------\n",
    ].join("\n");

    // fs.appendFileSync(filename, logContent);
    logger.debug(`Email headers logged to ${filename}`);
  } catch (error) {
    logger.error("Failed to log email headers:", error);
  }
};

// -----------------------------------------
// -----------------------------------------
// -----------------------------------------

// TODO: move this to types
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
