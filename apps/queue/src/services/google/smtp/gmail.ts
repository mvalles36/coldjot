import { prisma } from "@mailjot/database";
import { createGmailTransport } from "./nodemailer";
import { google } from "googleapis";
import { generateMessageId } from "@/utils";
import {
  generateEmailHeaders,
  generateMimeParts,
  debeaconizeContent,
  processEmailParts,
  createMailOptions,
} from "./helper";

import {
  formatSenderInfo,
  generateMimeBoundary,
  convertToPlainText,
  generateDebeaconizedId,
  convertEmailToBase64Format,
  parseMimeBoundary,
  splitEmailContent,
} from "@/utils";

import { gmailClientService } from "../gmail/gmail";
import { getThreadInfo } from "../../email/helper";
import { logger } from "@/services/log/logger";
import {
  SendGmailOptions,
  GmailResponse,
  UpdateSentEmailOptions,
} from "@mailjot/types";

export async function sendGmailSMTP({
  to,
  subject,
  content,
  threadId,
  originalContent,
  accessToken,
}: SendGmailOptions): Promise<GmailResponse> {
  // Generate message ID and boundary
  const messageId = generateMessageId();
  console.log("Generated message ID", messageId);
  const boundary = generateMimeBoundary();

  logger.info(content, "Content");

  // Get account information
  const account = await prisma.account.findFirst({
    where: { access_token: accessToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!account?.user?.email) {
    throw new Error("User email not found");
  }

  // Set up sender information
  const senderEmail = account.user.email;
  const fromHeader = formatSenderInfo(senderEmail, account.user.name!);

  // Create Gmail client for fetching thread information
  const gmail = await gmailClientService.getClient(account.user.id!);

  // If threadId exists, fetch the original message headers
  const { threadHeaders, originalSubject } = await getThreadInfo(
    gmail,
    threadId
  );

  // Generate email headers with thread information
  const headers = generateEmailHeaders({
    fromHeader,
    to,
    subject,
    messageId,
    threadId,
    boundary,
    originalSubject: originalSubject || subject,
    threadHeaders,
  });

  // Convert content to plain text
  const plainText = convertToPlainText(originalContent || content);

  const { plainTextPart, senderPart, recipientPart } = generateMimeParts({
    boundary,
    plainText,
    originalContent,
    content,
  });

  // Create mail options
  const mailOptions = createMailOptions(
    senderEmail,
    to,
    headers,
    plainTextPart,
    senderPart,
    recipientPart
  );

  // Create transport
  const transport = await createGmailTransport(
    account.access_token!,
    account.refresh_token!,
    senderEmail,
    account.user.name!
  );

  // Send email
  const result = await transport.sendMail(mailOptions);
  console.log("Message ID", messageId);
  console.log("Result Message ID", result.messageId);

  // Wait for Gmail to process the message
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Find the sent message
  const response = await gmail.users.messages.list({
    userId: "me",
    q: `subject:"${subject}" to:${to}`,
    maxResults: 1,
  });

  const actualMessageId = response.data.messages?.[0]?.id;
  if (!actualMessageId) {
    throw new Error("Could not find sent message");
  }

  // Get message details
  const messageDetails = await gmail.users.messages.get({
    userId: "me",
    id: actualMessageId,
  });

  // Update sent message with debeaconized version if needed
  if (accessToken) {
    try {
      console.log("Updating sent email...");
      console.log("Thread ID", messageDetails.data.threadId);
      console.log("Message ID", messageId);

      const newInsertedId = await updateSentEmail({
        to,
        subject,
        accessToken,
        messageId: actualMessageId,
        originalContent: originalContent || content,
        threadId: messageDetails.data.threadId!,
      });

      if (newInsertedId) {
        return {
          messageId: newInsertedId,
          threadId: messageDetails.data.threadId!,
        };
      }
    } catch (error) {
      console.error("Failed to update sent email:", error);
    }
  }

  return {
    messageId: actualMessageId,
    threadId: messageDetails.data.threadId!,
  };
}

export async function updateSentEmail({
  to,
  subject,
  accessToken,
  messageId,
  originalContent,
  threadId,
}: UpdateSentEmailOptions): Promise<string> {
  // Get account information
  const account = await prisma.account.findFirst({
    where: { access_token: accessToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });

  if (!account?.user?.id) {
    throw new Error("User ID or account not found");
  }

  const gmail = await gmailClientService.getClient(account.user.id!);

  try {
    // Get the original message
    const originalRaw = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "raw",
    });

    if (!originalRaw.data.raw) {
      throw new Error("Could not get raw message content");
    }

    // Decode and split the message
    const emailContent = Buffer.from(originalRaw.data.raw, "base64").toString();

    const { headers, body } = splitEmailContent(emailContent);

    // Get boundary and process parts
    const boundary = parseMimeBoundary(headers);
    const parts = body
      .split(`--${boundary}`)
      .filter((part) => part.trim() && !part.startsWith("--"));

    const processedParts = await processEmailParts(parts, boundary);
    const debeaconizedId = generateDebeaconizedId();

    // Reconstruct the email
    const newEmailContent = [
      `X-MT-Debeaconized-From: ${debeaconizedId}`,
      headers,
      "",
      ...processedParts.map((part) => `--${boundary}\r\n${part}`),
      `--${boundary}--\r\n`,
    ].join("\r\n");

    // Convert to base64url
    const base64EncodedEmail = convertEmailToBase64Format(newEmailContent);

    // Insert debeaconized version
    console.log("Inserting debeaconized version...");
    const insertResponse = await gmail.users.messages.insert({
      userId: "me",
      requestBody: {
        raw: base64EncodedEmail,
        threadId: threadId,
        labelIds: originalRaw.data.labelIds,
      },
    });

    if (insertResponse.data.id) {
      console.log("Inserted message ID:", insertResponse.data.id);

      try {
        console.log("Deleting original message:", messageId);
        await gmail.users.messages.delete({
          userId: "me",
          id: messageId,
        });
        console.log("Original message deleted successfully");
      } catch (err) {
        console.error("Error deleting original message:", err);
      }
    }

    return insertResponse.data.id || "";
  } catch (err) {
    console.error("Error processing message:", err);
    throw err;
  }
}
