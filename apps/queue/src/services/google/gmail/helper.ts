import { logger } from "../../log/logger";
import { refreshAccessToken } from "../account/google-account";
import { GmailCredentials } from "@mailjot/types";
/**
 * Check if the access token needs to be refreshed
 * Refreshes token if it's about to expire within 5 minutes
 */
export function shouldRefreshToken(credentials: GmailCredentials): boolean {
  // If expiryDate exists and is within 5 minutes of expiring
  const needsRefresh =
    credentials.expiryDate &&
    credentials.expiryDate < Date.now() + 5 * 60 * 1000; // 5 minutes buffer

  if (needsRefresh) {
    logger.info("🔄 Token expired or about to expire, refreshing...");
  }

  return needsRefresh ? needsRefresh : false;
}

/**
 * Refresh the access token if needed
 * Returns the current valid access token (either refreshed or existing)
 */
export async function refreshTokenIfNeeded(
  credentials: GmailCredentials
): Promise<string> {
  try {
    if (shouldRefreshToken(credentials)) {
      logger.info(
        { userId: credentials.userId },
        "🔄 Attempting to refresh access token"
      );

      const newAccessToken = await refreshAccessToken(
        credentials.userId,
        credentials.refreshToken
      );

      if (!newAccessToken) {
        throw new Error("Failed to refresh access token");
      }

      logger.info(
        { userId: credentials.userId },
        "✅ Access token refreshed successfully"
      );

      return newAccessToken;
    }

    return credentials.accessToken;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        userId: credentials.userId,
      },
      "❌ Failed to refresh access token"
    );
    throw error;
  }
}

/**
 * Validate required Gmail credentials
 * Throws an error if required credentials are missing
 */
export function validateGmailCredentials(credentials: GmailCredentials): void {
  logger.info("🔄 Validating Gmail credentials");

  const isTokenExpired =
    !credentials.expiryDate || new Date(credentials.expiryDate) <= new Date();
  if (!credentials.accessToken || !credentials.refreshToken) {
    logger.error(
      {
        userId: credentials.userId,
        hasAccessToken: !!credentials.accessToken,
        hasRefreshToken: !!credentials.refreshToken,
      },
      "❌ Missing required tokens"
    );
    throw new Error("Missing required tokens");
  }
}

/**
 * Set OAuth2 credentials with the provided access token and options
 */
export function setOAuth2Credentials(
  auth: any,
  accessToken: string,
  credentials: GmailCredentials
): void {
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: credentials.refreshToken,
    token_type: credentials.tokenType || "Bearer",
    expiry_date: credentials.expiryDate,
  });
}
