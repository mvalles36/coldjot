import { prisma } from "@/lib/prisma";
import { sleep } from "@/utils/email-utils";
import { google } from "googleapis";

export interface GoogleAccount {
  access_token: string;
  refresh_token: string;
  providerAccountId: string;
}

export async function getGoogleAccount(
  userId: string
): Promise<GoogleAccount | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId: userId,
      provider: "google",
    },
    select: {
      access_token: true,
      refresh_token: true,
      providerAccountId: true,
    },
  });

  if (
    !account?.access_token ||
    !account?.refresh_token ||
    !account?.providerAccountId
  ) {
    return null;
  }

  return {
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    providerAccountId: account.providerAccountId,
  };
}

// Configure Gmail OAuth2 client
export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.AUTH_URL}/api/auth/callback/google`
);

interface TokenRefreshError extends Error {
  code?: string;
  status?: number;
}

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

      // Save the new access token
      const account = await prisma.account.findFirst({
        where: {
          refresh_token: refreshToken,
        },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      await prisma.account.update({
        where: { id: account.id },
        data: { access_token: credentials.access_token },
      });

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
