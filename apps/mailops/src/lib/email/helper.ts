import { encode as base64Encode } from "js-base64";
import { normalizeSubject } from "@/utils";
import { type ThreadHeaders } from "@coldjot/types";

import { Mailbox } from "@coldjot/types";

import type { SenderInfo, MessageHeader, GmailMessage } from "@coldjot/types";

export async function generateSenderInfo(
  mailbox: Mailbox
): Promise<SenderInfo> {
  const senderEmail = mailbox.email;
  const senderName = mailbox.name;
  const header = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  return {
    email: senderEmail!,
    name: senderName || undefined,
    header: header!,
  };
}

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
