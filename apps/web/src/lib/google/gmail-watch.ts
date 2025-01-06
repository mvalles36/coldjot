import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@coldjot/database";
import { refreshAccessToken } from "@/lib/google/google-account";

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
  try {
    console.log("🔄 Setting up Gmail watch...");

    // First, stop any existing watch
    try {
      await stopGmailWatch(userId);
    } catch (error) {
      console.log("Note: No existing watch to stop or failed to stop");
    }

    const gmail = google.gmail({ version: "v1" });
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });

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
      const account = await prisma.account.findFirst({
        where: {
          userId,
          provider: "google",
        },
      });

      if (account) {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            watchHistoryId: response.data.historyId,
            watchExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });
      }
    }

    console.log("✅ Gmail watch setup successful");
    return response.data;
  } catch (error) {
    console.error("❌ Failed to setup Gmail watch:", error);
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
      userId: true,
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

    console.log(`7️⃣ Refreshing access token point`);
    const newAccessToken = await refreshAccessToken(
      account.userId,
      account.refresh_token
    );

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

export async function stopGmailWatch(userId: string): Promise<boolean> {
  try {
    console.log("🛑 Stopping Gmail watch for user:", userId);

    // Get the user's Google account
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    });

    if (!account?.access_token) {
      throw new Error("No valid Google account found");
    }

    // Check if token needs refresh
    let accessToken = account.access_token;
    const now = Math.floor(Date.now() / 1000);

    if (
      account.expires_at &&
      account.expires_at < now &&
      account.refresh_token
    ) {
      console.log(`7️⃣ Refreshing access token point`);
      const newAccessToken = await refreshAccessToken(
        userId,
        account.refresh_token
      );
      if (!newAccessToken) {
        throw new Error("Failed to refresh token");
      }
      accessToken = newAccessToken;

      // Update the token in database
      // await prisma.account.update({
      //   where: { id: account.id },
      //   data: {
      //     access_token: accessToken,
      //     expires_at: Math.floor(Date.now() / 1000 + 3600),
      //   },
      // });
    }

    // Initialize Gmail API client
    const gmail = google.gmail({ version: "v1" });
    // const auth = new OAuth2Client();
    const auth = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.AUTH_URL}/api/auth/callback/google`
    );

    auth.setCredentials({ access_token: accessToken });

    // Stop watching
    await gmail.users.stop({
      userId: "me",
      auth,
    });

    // Clear watch data from database
    await prisma.account.update({
      where: { id: account.id },
      data: {
        watchHistoryId: null,
        watchExpiration: null,
      },
    });

    console.log("✅ Successfully stopped Gmail watch");
    return true;
  } catch (error) {
    console.error("❌ Failed to stop Gmail watch:", error);
    throw error;
  }
}
