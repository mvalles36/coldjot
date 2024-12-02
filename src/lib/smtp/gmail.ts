import { createTransport } from "nodemailer";
import type { TransportOptions } from "nodemailer";
import { generateMessageId } from "@/utils/email-utils";
import { prisma } from "@/lib/prisma";
import { createGmailTransport } from "./nodemailer";
import { encode as quotedPrintableEncode } from "quoted-printable";
import crypto from "crypto";

function generateMimeBoundary() {
  return `m${Math.random().toString(36).substring(2)}${Date.now().toString(
    36
  )}`;
}

interface SendGmailOptions {
  to: string;
  subject: string;
  content: string;
  threadId?: string;
  originalContent?: string;
  accessToken?: string;
}

interface GmailResponse {
  messageId: string;
  threadId?: string;
}

export async function sendGmailSMTP({
  to,
  subject,
  content,
  threadId,
  originalContent,
  accessToken,
}: SendGmailOptions): Promise<GmailResponse> {
  // const messageId = `<${generateMessageId()}@depexel.com>`;
  const messageId = `<${generateMessageId()}@gmail.com>`;
  const boundary = generateMimeBoundary();

  const senderEmail = process.env.GMAIL_EMAIL;
  if (!senderEmail) {
    throw new Error("GMAIL_EMAIL environment variable is not defined");
  }

  const account = await prisma.account.findFirst({
    where: { access_token: accessToken },
  });

  const transport = await createGmailTransport(
    account?.access_token! || "",
    account?.refresh_token! || ""
  );

  const plainText = (originalContent || content)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  const headers = [
    "MIME-Version: 1.0",
    `From: ${senderEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    threadId ? `References: ${threadId}` : "",
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const plainTextPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    plainText,
    "",
  ].join("\r\n");

  const senderPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    // "Content-Transfer-Encoding: quoted-printable",
    "X-View-Type: sender",
    "",
    originalContent || content,
    "",
  ].join("\r\n");

  const recipientPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    // "Content-Transfer-Encoding: quoted-printable",
    "X-View-Type: recipient",
    "",
    content,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const mailOptions = {
    envelope: {
      from: senderEmail,
      to: [to],
    },
    raw: [headers, "", plainTextPart, senderPart, recipientPart].join("\r\n"),
  };

  const result = await transport.sendMail(mailOptions);

  // console.log("result", result);
  console.log("Message ID", messageId);
  console.log("Result Message ID", result.messageId);

  // Create Gmail API client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  oauth2Client.setCredentials({
    access_token: account?.access_token!,
    refresh_token: account?.refresh_token!,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Wait a bit for Gmail to process the message
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // List recent messages to find our just-sent email
  const response = await gmail.users.messages.list({
    userId: "me",
    q: `subject:"${subject}" to:${to}`,
    maxResults: 1,
  });

  const actualMessageId = response.data.messages?.[0]?.id;

  if (!actualMessageId) {
    throw new Error("Could not find sent message");
  }

  // Get full message details to get thread ID
  const messageDetails = await gmail.users.messages.get({
    userId: "me",
    id: actualMessageId,
  });

  // Now update the sent message with debeaconized version
  if (accessToken) {
    try {
      console.log("Updating sent email...");
      console.log("Original content", originalContent);
      console.log("Content", content);
      console.log("Thread ID", messageDetails.data.threadId);
      console.log("Message ID", messageId);
      await updateSentEmail({
        to,
        subject,
        accessToken,
        messageId: actualMessageId,
        originalContent: originalContent || content,
        threadId: messageDetails.data.threadId!,
      });
    } catch (error) {
      console.error("Failed to update sent email:", error);
    }
  }

  return {
    messageId: actualMessageId,
    threadId: messageDetails.data.threadId!,
  };
}

import { google } from "googleapis";
import { Base64 } from "js-base64";
import { oauth2Client } from "@/lib/google/google-account";

interface UpdateSentEmailOptions {
  to: string;
  subject: string;
  accessToken: string;
  messageId: string;
  originalContent: string;
  threadId?: string;
}

async function debeaconizeContent(content: string): Promise<string> {
  // Replace tracking pixel with transparent GIF
  const transparentGif =
    "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=";

  // Replace tracking pixels
  let debeaconized = content.replace(
    /<img[^>]*src="https:\/\/[^"]*\/api\/track\/[^"]*\.png"[^>]*>/g,
    `<img src="${transparentGif}" alt="" style="display:none" width="1" height="1">`
  );

  // Add notrack=1 to all tracked links
  debeaconized = debeaconized.replace(
    /href="(https:\/\/[^"]*\/track[^"]+)"/g,
    (match, url) => {
      const separator = url.includes("?") ? "&" : "?";
      return `href="${url}${separator}notrack=1"`;
    }
  );

  console.log("Debeaconized content in the function:", debeaconized);

  return debeaconized;
}

export async function updateSentEmail({
  to,
  subject,
  accessToken,
  messageId,
  originalContent,
  threadId,
}: UpdateSentEmailOptions): Promise<void> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  const account = await prisma.account.findFirst({
    where: { access_token: accessToken },
  });

  oauth2Client.setCredentials({
    access_token: account?.access_token!,
    refresh_token: account?.refresh_token!,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    // Get the original message's raw content
    const originalRaw = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "raw",
    });

    if (!originalRaw.data.raw) {
      throw new Error("Could not get raw message content");
    }

    // Decode the raw message
    let emailContent = Buffer.from(originalRaw.data.raw, "base64").toString();

    console.log("Email content:", emailContent);

    // Update the email content with the debeaconized version
    emailContent = await debeaconizeContent(emailContent);

    console.log("Debeaconized email content:", emailContent);

    // Generate debeaconized ID
    const debeaconizedId = crypto.randomBytes(8).toString("hex");

    // Add debeaconization header while keeping original content
    emailContent = `X-MT-Debeaconized-From: ${debeaconizedId}\r\n${emailContent}`;

    // Convert back to base64url
    const base64EncodedEmail = Buffer.from(emailContent)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

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
      // await new Promise((resolve) => setTimeout(resolve, 5000));

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
  } catch (err) {
    console.error("Error processing message:", err);
    throw err;
  }
}
