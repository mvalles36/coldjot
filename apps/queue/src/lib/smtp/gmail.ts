import { generateMessageId } from "@/utils";
import { prisma } from "@mailjot/database";
import { createGmailTransport } from "./nodemailer";
import { google } from "googleapis";
import {
  encode as quotedPrintableEncode,
  decode as quotedPrintableDecode,
} from "quoted-printable";
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
  const messageId = `${generateMessageId()}`;
  console.log("Generated message ID", messageId);
  const boundary = generateMimeBoundary();

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
  const fromHeader = senderName
    ? `${senderName} <${senderEmail}>`
    : senderEmail;

  const transport = await createGmailTransport(
    account.access_token! || "",
    account.refresh_token! || "",
    senderEmail,
    senderName || undefined
  );

  const plainText = (originalContent || content)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  const headers = [
    "MIME-Version: 1.0",
    `From: ${fromHeader}`,
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
    "Content-Transfer-Encoding: quoted-printable",
    "",
    quotedPrintableEncode(plainText),
    "",
  ].join("\r\n");

  const senderPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "X-View-Type: sender",
    "",
    quotedPrintableEncode(originalContent || content),
    "",
  ].join("\r\n");

  const recipientPart = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: quoted-printable",
    "X-View-Type: recipient",
    "",
    quotedPrintableEncode(content),
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

interface UpdateSentEmailOptions {
  to: string;
  subject: string;
  accessToken: string;
  messageId: string;
  originalContent: string;
  threadId?: string;
}

async function debeaconizeContent(content: string): Promise<string> {
  // First decode the quoted-printable content if it is encoded
  let decodedContent = content;
  try {
    if (content.includes("=3D") || content.includes("=20")) {
      decodedContent = quotedPrintableDecode(content);
    }
  } catch (error) {
    console.log("Error decoding quoted-printable content:", error);
  }

  // Replace tracking pixel with transparent GIF
  const transparentGif =
    "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=";

  // Replace tracking pixels with base64 encoded transparent GIF
  let debeaconized = decodedContent.replace(
    /<img[^>]*src="[^"]*\/api\/track\/[^"]*\.png"[^>]*>/g,
    `<img src="${transparentGif}" alt="" style="display:none" width="1" height="1">`
  );

  // Re-encode as quoted-printable, but preserve the base64 encoded GIF
  return quotedPrintableEncode(debeaconized).replace(
    new RegExp(quotedPrintableEncode(transparentGif), "g"),
    transparentGif
  );
}

export async function updateSentEmail({
  to,
  subject,
  accessToken,
  messageId,
  originalContent,
  threadId,
}: UpdateSentEmailOptions): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

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

    // Split headers and body
    const [headers, ...bodyParts] = emailContent.split("\r\n\r\n");
    const body = bodyParts.join("\r\n\r\n");

    // Parse the boundary from headers
    const boundaryMatch = headers.match(/boundary="([^"]+)"/);
    if (!boundaryMatch) {
      throw new Error("Could not find boundary in email headers");
    }
    const boundary = boundaryMatch[1];

    // Split the body into parts using the boundary
    const parts = body
      .split(`--${boundary}`)
      .filter((part) => part.trim() && !part.startsWith("--"));

    // Process each part
    const processedParts = await Promise.all(
      parts.map(async (part) => {
        const [partHeaders, ...partContent] = part.trim().split("\r\n\r\n");
        const content = partContent.join("\r\n\r\n");

        if (partHeaders.includes("Content-Type: text/html")) {
          const debeaconized = await debeaconizeContent(content);
          return `${partHeaders}\r\n\r\n${debeaconized}`;
        }
        return `${partHeaders}\r\n\r\n${content}`;
      })
    );

    // Generate debeaconized ID
    const debeaconizedId = crypto.randomBytes(8).toString("hex");

    // Reconstruct the email
    const newEmailContent = [
      `X-MT-Debeaconized-From: ${debeaconizedId}`,
      headers,
      "",
      ...processedParts.map((part) => `--${boundary}\r\n${part}`),
      `--${boundary}--\r\n`,
    ].join("\r\n");

    // Convert back to base64url
    const base64EncodedEmail = Buffer.from(newEmailContent)
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
