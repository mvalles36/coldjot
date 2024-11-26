import { google } from "googleapis";
import { createTransport } from "nodemailer";
import { encode as base64Encode } from "js-base64";
import type { TransportOptions } from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  content: string;
  threadId?: string;
  accessToken?: string;
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

// Configure Gmail OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.AUTH_URL}/api/auth/callback/google`
);

interface TokenRefreshError extends Error {
  code?: string;
  status?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function refreshAccessToken(
  refreshToken: string,
  maxRetries = 3
): Promise<string | null> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error("No access token returned");
      }

      console.log(`🔄 Token refreshed successfully on attempt ${attempt + 1}`);
      return credentials.access_token;
    } catch (error) {
      attempt++;
      const err = error as TokenRefreshError;

      // Log the error details
      console.error(`❌ Token refresh attempt ${attempt} failed:`, {
        error: err.message,
        code: err.code,
        status: err.status,
      });

      // If we've exhausted all retries, throw the error
      if (attempt === maxRetries) {
        console.error(`❌ Token refresh failed after ${maxRetries} attempts`);
        throw new Error(`Failed to refresh token: ${err.message}`);
      }

      // Calculate delay with exponential backoff (1s, 2s, 4s, etc.)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`⏳ Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  return null;
}

// Add new types and utilities for email threading
interface ThreadHeaders {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}

const generateMessageId = () => {
  const domain = process.env.EMAIL_DOMAIN || "gmail.com";
  return `<${Date.now()}.${Math.random().toString(36).substring(2)}@${domain}>`;
};

const normalizeMessageId = (messageId: string): string => {
  if (!messageId) return "";
  return messageId.includes("@") ? messageId : `<${messageId}@gmail.com>`;
};

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

const normalizeSubject = (
  subject: string,
  isReply: boolean,
  originalSubject?: string
): string => {
  // If we have an original subject from the thread and this is a reply, use that
  const baseSubject = isReply && originalSubject ? originalSubject : subject;
  // Remove any existing "Re:" prefixes and trim
  const cleanSubject = baseSubject.replace(/^(Re:\s*)+/i, "").trim();
  // Add "Re:" prefix if it's a reply and encode the final subject
  const finalSubject = isReply ? `Re: ${cleanSubject}` : cleanSubject;
  return encodeMIMEWords(finalSubject);
};

export async function sendEmail({
  to,
  subject,
  content,
  threadId,
  accessToken,
}: SendEmailOptions): Promise<EmailResponse> {
  try {
    if (accessToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: accessToken,
        token_type: "Bearer",
      });

      const gmail = google.gmail({ version: "v1", auth });

      // Get thread information and build headers
      let threadHeaders: ThreadHeaders = {
        messageId: generateMessageId(),
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
            // Get subject from the first message in the thread
            const firstMessage = messages[0];
            const firstMessageHeaders = firstMessage.payload?.headers || [];
            const rawOriginalSubject = firstMessageHeaders.find(
              (h) => h.name?.toLowerCase() === "subject"
            )?.value;

            // Decode MIME encoded subject if necessary
            if (rawOriginalSubject) {
              originalSubject = rawOriginalSubject.replace(
                /=\?UTF-8\?B\?(.*?)\?=/g,
                (match, p1) => Buffer.from(p1, "base64").toString("utf8")
              );
            }

            const lastMessage = messages[messages.length - 1];
            const headers = lastMessage.payload?.headers || [];

            // Get the last message ID for In-Reply-To
            const lastMessageId = headers.find(
              (h) => h.name?.toLowerCase() === "message-id"
            )?.value;

            // Build references chain
            const references = messages
              .map((msg) => {
                const msgIdHeader = msg.payload?.headers?.find(
                  (h) => h.name?.toLowerCase() === "message-id"
                );
                return msgIdHeader?.value || "";
              })
              .filter(Boolean);

            threadHeaders = {
              messageId: generateMessageId(),
              inReplyTo: lastMessageId || undefined,
              references: references,
            };

            console.log("📧 Thread headers prepared:", threadHeaders);
            if (originalSubject) {
              console.log("📧 Using original thread subject:", originalSubject);
            }
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
        `Message-ID: ${threadHeaders.messageId}`,
        ...(threadHeaders.inReplyTo
          ? [`In-Reply-To: ${threadHeaders.inReplyTo}`]
          : []),
        ...(threadHeaders.references?.length
          ? [`References: ${threadHeaders.references.join(" ")}`]
          : []),
        "",
        content,
      ].join("\n");

      console.log("📧 Email headers:", {
        subject: normalizeSubject(subject, !!threadId, originalSubject),
        messageId: threadHeaders.messageId,
        inReplyTo: threadHeaders.inReplyTo,
        referencesCount: threadHeaders.references?.length,
      });

      const encodedMessage = base64Encode(message)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
          threadId: threadId || undefined,
        },
      });

      return {
        messageId: response.data.id || "",
        threadId: response.data.threadId || undefined,
      };
    } else {
      // Fallback to Nodemailer if no access token
      const transport = createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          user: process.env.GMAIL_EMAIL,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: process.env.GOOGLE_REFRESH_TOKEN, // TODO : use custom value from user
          accessToken: await oauth2Client.getAccessToken(),
        },
      } as TransportOptions);

      const mailOptions = {
        from: process.env.GMAIL_EMAIL,
        to,
        subject,
        html: content,
        ...(threadId && {
          headers: {
            "In-Reply-To": threadId,
            References: threadId,
          },
        }),
      };

      const result = await transport.sendMail(mailOptions);
      return {
        messageId: result.messageId || "",
        threadId: undefined,
      };
    }
  } catch (error: any) {
    if (error.status === 401) {
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
