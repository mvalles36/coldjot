import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/email";

interface WatchRequest {
  userId: string;
  accessToken: string;
  topicName: string;
  labelIds?: string[];
}

export async function setupGmailWatch({
  userId,
  accessToken,
  topicName,
  labelIds = ["INBOX"],
}: WatchRequest) {
  const gmail = google.gmail({ version: "v1" });
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });

  try {
    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        labelIds,
        topicName,
        labelFilterAction: "include",
      },
      auth,
    });

    if (response.data?.historyId) {
      // Store the historyId to track changes from this point
      const account = await prisma.account.findFirst({
        where: {
          userId,
          provider: "google",
        },
      });

      if (account) {
        await prisma.account.update({
          where: {
            id: account.id,
          },
          data: {
            watchHistoryId: response.data.historyId,
            watchExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
      }
    }

    return response.data;
  } catch (error) {
    console.error("Failed to setup Gmail watch:", error);
    throw error;
  }
}

export async function refreshGmailWatch(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
    },
  });

  if (!account?.access_token || !account?.refresh_token) {
    throw new Error("No valid Google account found");
  }

  let accessToken = account.access_token;

  try {
    // Refresh token if needed
    const newToken = await refreshAccessToken(account.refresh_token);
    if (newToken) {
      accessToken = newToken;

      // Update the access token in the database
      await prisma.account.update({
        where: { id: account.id },
        data: { access_token: newToken },
      });
    }

    return await setupGmailWatch({
      userId,
      accessToken,
      topicName: process.env.GMAIL_WATCH_TOPIC!,
    });
  } catch (error) {
    console.error("Failed to refresh Gmail watch:", error);
    throw error;
  }
}
