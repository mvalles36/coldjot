import { google } from "googleapis";
import { encode as base64Encode } from "js-base64";
import { prisma } from "@mailjot/database";
import { GoogleAccount } from "@mailjot/types";

import type { gmail_v1 } from "googleapis";
import { logger } from "../../log/logger";
import {
  validateGmailCredentials,
  refreshTokenIfNeeded,
  setOAuth2Credentials,
} from "./helper";

import type {
  GmailCredentials,
  GmailClientConfig,
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

  // -------------------------------------------------------

  public static getInstance(): GmailClientService {
    if (!GmailClientService.instance) {
      GmailClientService.instance = new GmailClientService();
    }
    return GmailClientService.instance;
  }

  // -------------------------------------------------------
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

  // -------------------------------------------------------

  /**
   * Get a Gmail client instance with automatic token refresh
   */
  // public async getClient(options: GmailCredentials): Promise<gmail_v1.Gmail> {
  public async getClient(userId: string): Promise<gmail_v1.Gmail> {
    try {
      logger.info(
        {
          userId: userId,
        },
        "🔄 Initializing Gmail client"
      );

      // Lets get user account here instead of passing it in
      const account = await prisma.account.findFirst({
        where: {
          userId: userId,
          provider: "google",
        },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      const credentials = {
        userId: account.userId,
        accessToken: account.access_token!,
        refreshToken: account.refresh_token!,
        expiryDate: account.expires_at!,
      };

      // Validate credentials
      validateGmailCredentials(credentials);

      // Create OAuth2 client
      const auth = this.createOAuth2Client();

      // Refresh token if needed and get the current valid access token
      const currentAccessToken = await refreshTokenIfNeeded(credentials);

      // Set the credentials with the current access token
      setOAuth2Credentials(auth, currentAccessToken, credentials);

      logger.info("🔄 OAuth2 client credentials set");

      // Create and return the Gmail client
      const gmail = google.gmail({ version: "v1", auth });

      logger.info({ userId: userId }, "✅ Gmail client created successfully");

      return gmail;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          userId: userId,
        },
        "❌ Failed to create Gmail client"
      );
      throw error;
    }
  }
}

// Export singleton instance
export const gmailClientService = GmailClientService.getInstance();

// -------------------------------------------------------
// -------------------------------------------------------
// -------------------------------------------------------

/**
 * @deprecated This method will be removed in the next major release.
 */

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

/**
 * @deprecated This method will be removed in the next major release.
 */

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
