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

export async function refreshAccessToken(refreshToken: string) {
  //   const oauth2Client = new google.auth.OAuth2(
  //     process.env.GOOGLE_CLIENT_ID,
  //     process.env.GOOGLE_CLIENT_SECRET,
  //     `${process.env.AUTH_URL}/api/auth/callback/google`
  //   );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw error;
  }
}

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

      // Add "Re:" to subject if it's a reply and doesn't already start with "Re:"
      // const emailSubject =
      //   threadId && !subject.toLowerCase().startsWith("re:")
      //     ? `Re: ${subject}`
      //     : subject;

      // For testing - keep this for now
      const emailSubject =
        threadId && !subject.toLowerCase().startsWith("re:")
          ? `Re: Demo Email`
          : "Demo Email";

      // Get the message ID from threadId if it exists
      let messageId = threadId;
      let references: string[] = [];

      if (threadId) {
        try {
          // Get all messages in the thread
          const thread = await gmail.users.threads.get({
            userId: "me",
            id: threadId,
            format: "metadata",
            metadataHeaders: ["Message-ID", "References", "In-Reply-To"],
          });

          if (thread.data.messages && thread.data.messages.length > 0) {
            // Get all message IDs in the thread for references
            references = thread.data.messages
              .map((msg) => {
                const headers = msg.payload?.headers || [];
                const msgIdHeader = headers.find(
                  (h) => h.name?.toLowerCase() === "message-id"
                );
                return msgIdHeader?.value || "";
              })
              .filter(Boolean);

            // Get the last message's ID for In-Reply-To
            const lastMsg =
              thread.data.messages[thread.data.messages.length - 1];
            const lastMsgHeaders = lastMsg.payload?.headers || [];
            const msgIdHeader = lastMsgHeaders.find(
              (h) => h.name?.toLowerCase() === "message-id"
            );
            if (msgIdHeader?.value) {
              messageId = msgIdHeader.value.replace(/[<>]/g, "");
            }

            console.log(`💾 Found message IDs in thread:`, references);
            console.log(`💾 Last message ID:`, messageId);
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
        `Subject: ${emailSubject}`,
        // Add Message-ID for this email
        `Message-ID: <${Date.now()}.${Math.random()
          .toString(36)
          .substring(2)}@gmail.com>`,
        // Add threading headers if this is a reply
        ...(messageId
          ? [
              `In-Reply-To: ${
                messageId.includes("@") ? messageId : `<${messageId}@gmail.com>`
              }`,
              `References: ${references.join(" ")}`,
            ]
          : []),
        "",
        content,
      ].join("\n");

      console.log(
        `💾 Email headers being sent:`,
        message.split("\n").slice(0, 6)
      );

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

      console.log(`💾 Email response:`, {
        messageId: response.data.id,
        threadId: response.data.threadId,
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
