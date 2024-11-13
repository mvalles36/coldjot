import { google } from "googleapis";
import { encode as base64Encode } from "js-base64";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.AUTH_URL}/api/auth/callback/google`
);

interface CreateDraftOptions {
  accessToken: string;
  to: string;
  subject: string;
  content: string;
}

interface SendDraftOptions {
  accessToken: string;
  draftId: string;
}

export async function createGmailDraft({
  accessToken,
  to,
  subject,
  content,
}: CreateDraftOptions) {
  try {
    // Set up new credentials for this request
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.AUTH_URL}/api/auth/callback/google`
    );

    auth.setCredentials({
      access_token: accessToken,
      token_type: "Bearer",
    });

    const gmail = google.gmail({ version: "v1", auth });

    // Create the email message in base64 format
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
  } catch (error) {
    console.error("Error creating Gmail draft:", error);
    throw error;
  }
}

export async function sendGmailDraft({
  accessToken,
  draftId,
}: SendDraftOptions) {
  try {
    // Set up new credentials for this request
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.AUTH_URL}/api/auth/callback/google`
    );

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
    console.error("Error sending Gmail draft:", error);
    throw error;
  }
}
