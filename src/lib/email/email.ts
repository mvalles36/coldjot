import { google } from "googleapis";
import { createTransport } from "nodemailer";
import { encode as base64Encode } from "js-base64";
import type { TransportOptions } from "nodemailer";
import nodemailer from "nodemailer";
import { sendGmailSMTP } from "@/lib/smtp/gmail";

import { EmailTrackingMetadata } from "@/types/sequences";
import {
  sleep,
  generateMessageId,
  normalizeSubject,
} from "@/utils/email-utils";

import { oauth2Client, refreshAccessToken } from "@/lib/google/google-account";
import { prisma } from "@/lib/prisma";

export interface SendEmailOptions {
  to: string;
  subject: string;
  content: string;
  threadId?: string;
  accessToken?: string;
  originalContent?: string;
}

export interface CreateDraftOptions {
  to: string;
  subject: string;
  content: string;
  accessToken: string;
}

export interface SendDraftOptions {
  draftId: string;
  accessToken: string;
}

export interface EmailResponse {
  messageId: string;
  threadId?: string;
}

// Add new types and utilities for email threading
interface ThreadHeaders {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}

// Add MIME word encoding for subjects with special characters or emojis
const encodeMIMEWords = (text: string): string => {
  // Check if the text needs encoding (contains non-ASCII characters)
  if (!/^[\x00-\x7F]*$/.test(text)) {
    // UTF-8 encode the text and convert to base64
    const encoded = Buffer.from(text, "utf-8").toString("base64");
    return `=?UTF-8?B?${encoded}?=`;
  }
  return text;
};

// Helper function to get base URL with fallback
const getBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) {
    console.warn("NEXT_PUBLIC_APP_URL is not set, using fallback URL");
    // For local testing, use ngrok URL if available
    if (process.env.NGROK_URL) {
      return process.env.NGROK_URL;
    }
    // In development, default to localhost:3000
    return process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://app.zkmail.io";
  }
  return url;
};

// Add flag to test SMTP approach
const USE_SMTP_DUAL_DELIVERY = process.env.USE_SMTP_DUAL_DELIVERY === "true";
const GMAIL_EMAIL = process.env.GMAIL_EMAIL;

// Common function to prepare mail options
function prepareMailOptions(
  to: string,
  subject: string,
  content: string,
  threadId?: string,
  messageId?: string
) {
  return {
    from: GMAIL_EMAIL || "me",
    to,
    subject,
    html: content,
    messageId: messageId ? `<${messageId}>` : undefined,
    ...(threadId && {
      headers: {
        "In-Reply-To": threadId,
        References: threadId,
        "X-GM-THRID": threadId, // Gmail-specific threading
      },
    }),
  };
}

// Add helper for MIME boundaries
function generateMimeBoundary() {
  return `00000000000${Math.random().toString(36).substr(2, 12)}`;
}

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

      // Generate a single messageId for both versions
      const messageId = generateMessageId();

      // Get thread information and build headers
      let threadHeaders: ThreadHeaders = {
        messageId: messageId, // Use the same messageId
      };

      let originalSubject: string | undefined;

      if (threadId) {
        try {
          const thread = await gmail.users.threads.get({
            userId: "me",
            id: threadId,
            format: "metadata",
            metadataHeaders: [
              "Message-ID",
              "References",
              "In-Reply-To",
              "Subject",
            ],
          });

          if (thread.data.messages && thread.data.messages.length > 0) {
            const messages = thread.data.messages;
            const firstMessage = messages[0];
            const firstMessageHeaders = firstMessage.payload?.headers || [];
            const rawOriginalSubject = firstMessageHeaders.find(
              (h) => h.name?.toLowerCase() === "subject"
            )?.value;

            if (rawOriginalSubject) {
              originalSubject = rawOriginalSubject.replace(
                /=\?UTF-8\?B\?(.*?)\?=/g,
                (match, p1) => Buffer.from(p1, "base64").toString("utf8")
              );
            }

            const lastMessage = messages[messages.length - 1];
            const headers = lastMessage.payload?.headers || [];

            const lastMessageId = headers.find(
              (h) => h.name?.toLowerCase() === "message-id"
            )?.value;

            const references = messages
              .map((msg) => {
                const msgIdHeader = msg.payload?.headers?.find(
                  (h) => h.name?.toLowerCase() === "message-id"
                );
                return msgIdHeader?.value || "";
              })
              .filter(Boolean);

            threadHeaders = {
              messageId: messageId, // Use the same messageId
              inReplyTo: lastMessageId || undefined,
              references: references,
            };
          }
        } catch (error) {
          console.error("Error getting thread details:", error);
        }
      }

      // Create email message with proper threading headers
      const message = [
        "Content-Type: text/html; charset=utf-8",
        "MIME-Version: 1.0",
        `To: ${to}`,
        `Subject: ${normalizeSubject(subject, !!threadId, originalSubject)}`,
        `Message-ID: <${messageId}>`, // Use formatted messageId
        ...(threadHeaders.inReplyTo
          ? [`In-Reply-To: ${threadHeaders.inReplyTo}`]
          : []),
        ...(threadHeaders.references?.length
          ? [`References: ${threadHeaders.references.join(" ")}`]
          : []),
        "",
        content,
      ].join("\n");

      const encodedMessage = base64Encode(message)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // Send tracked version to recipient
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
          threadId: threadId || undefined,
        },
      });

      // Insert untracked version in sender's mailbox
      if (originalContent) {
        const sentMessage = await gmail.users.messages.get({
          userId: "me",
          id: response.data.id || "",
          format: "full",
        });

        const headers = sentMessage.data.payload?.headers || [];
        const from =
          headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
        const date =
          headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

        const untrackedMessage = [
          "Content-Type: text/html; charset=utf-8",
          "MIME-Version: 1.0",
          `From: ${from}`,
          `Date: ${date}`,
          `To: ${to}`,
          `Subject: ${normalizeSubject(subject, !!threadId, originalSubject)}`,
          `Message-ID: <${messageId}>`, // Use the same formatted messageId
          ...(threadHeaders.inReplyTo
            ? [`In-Reply-To: ${threadHeaders.inReplyTo}`]
            : []),
          ...(threadHeaders.references?.length
            ? [`References: ${threadHeaders.references.join(" ")}`]
            : []),
          "",
          originalContent,
        ].join("\n");

        const encodedUntrackedMessage = base64Encode(untrackedMessage)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

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

async function createGmailTransport(accessToken: string, refreshToken: string) {
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL + "/api/auth/callback/google"
  );

  // Set credentials
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Create SMTP transport
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_EMAIL,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: refreshToken,
      accessToken: accessToken,
      expires: 3599, // Default token expiry time in seconds
    },
    pool: true, // Use pooled connections
    maxConnections: 5, // Maximum number of simultaneous connections
    maxMessages: 100, // Maximum number of messages per connection
    rateDelta: 1000, // How many milliseconds between messages
    rateLimit: 5, // Maximum number of messages per rateDelta
  } as TransportOptions);

  // Verify SMTP connection configuration
  try {
    await new Promise((resolve, reject) => {
      transport.verify((error) => {
        if (error) {
          console.error("SMTP Connection Error:", error);
          reject(error);
        } else {
          console.log("SMTP Connection Successful");
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error("Failed to verify SMTP connection:", error);
    throw error;
  }

  return transport;
}
