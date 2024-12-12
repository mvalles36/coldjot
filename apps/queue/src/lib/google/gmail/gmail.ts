import { google } from "googleapis";
import { encode as base64Encode } from "js-base64";
import type { gmail_v1 } from "googleapis";
import { logger } from "../../log/logger";
import type {
  GmailClientConfig,
  GmailClientOptions,
  CreateDraftOptions,
  SendDraftOptions,
} from "@mailjot/types";

// -------------------------------------------------------
// -------------------------------------------------------
// -------------------------------------------------------

// Gmail Client Class
export class GmailClientService {
  private static instance: GmailClientService;
  private config: GmailClientConfig;

  private constructor() {
    this.config = {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${process.env.AUTH_URL}/api/auth/callback/google`,
    };
  }

  public static getInstance(): GmailClientService {
    if (!GmailClientService.instance) {
      GmailClientService.instance = new GmailClientService();
    }
    return GmailClientService.instance;
  }

  /**
   * Create an OAuth2 client with the provided configuration
   */
  private createOAuth2Client() {
    return new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
  }

  /**
   * Set credentials on the OAuth2 client
   */
  private setCredentials(auth: any, options: GmailClientOptions) {
    auth.setCredentials({
      access_token: options.accessToken,
      token_type: options.tokenType || "Bearer",
    });
  }

  /**
   * Get a Gmail client instance
   */
  public async getClient(options: GmailClientOptions): Promise<gmail_v1.Gmail> {
    try {
      logger.info(
        {
          userId: options.userId || "unknown",
        },
        "🔄 Creating Gmail client"
      );

      const auth = this.createOAuth2Client();
      this.setCredentials(auth, options);

      const gmail = google.gmail({ version: "v1", auth });

      logger.info("✅ Gmail client created successfully");
      return gmail;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          userId: options.userId || "unknown",
        },
        "❌ Failed to create Gmail client"
      );
      throw error;
    }
  }
}

// Export singleton instance
export const gmailClientService = GmailClientService.getInstance();

/**
 * Legacy getGmailClient function for backward compatibility
 * @deprecated Use gmailClientService.getClient() instead
 */
export async function getGmailClient(userId: string, accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.AUTH_URL}/api/auth/callback/google`
  );

  auth.setCredentials({
    access_token: accessToken,
    token_type: "Bearer",
  });

  return google.gmail({ version: "v1", auth });
}

// -------------------------------------------------------
// -------------------------------------------------------
// -------------------------------------------------------

export async function createGmailDraft({
  accessToken,
  to,
  subject,
  content,
}: CreateDraftOptions) {
  try {
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

    try {
      // Try with current access token
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
      throw error;
    }
  } catch (error) {
    console.error("Error creating Gmail draft:", error);
    throw error;
  }
}

// -------------------------------------------------------
// -------------------------------------------------------
// -------------------------------------------------------

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

// -------------------------------------------------------
// -------------------------------------------------------
// -------------------------------------------------------

export async function getGmailEmail(accessToken: string, messageId: string) {
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

  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  return response.data;
}

// -------------------------------------------------------
// -------------------------------------------------------
// -------------------------------------------------------

export async function getGmailThread(accessToken: string, threadId: string) {
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

  const response = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
  });

  return response.data;
}
