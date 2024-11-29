import { NextRequest, NextResponse } from "next/server";
import { setupGmailWatch, stopGmailWatch } from "@/lib/google/gmail-watch";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/google/google-account";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === "stop") {
      await stopGmailWatch(session.user.id);
      return NextResponse.json({
        success: true,
        message: "Gmail watch stopped",
      });
    } else if (action === "start") {
      const account = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "google",
        },
        select: {
          access_token: true,
          refresh_token: true,
          providerAccountId: true,
        },
      });

      if (!account?.access_token || !account?.refresh_token) {
        return NextResponse.json(
          { error: "No Google account found" },
          { status: 404 }
        );
      }

      const freshAccessToken = await refreshAccessToken(account.refresh_token);
      if (!freshAccessToken) {
        return NextResponse.json(
          { error: "Failed to refresh access token" },
          { status: 401 }
        );
      }

      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: freshAccessToken,
        },
      });

      await setupGmailWatch({
        userId: session.user.id,
        accessToken: freshAccessToken,
        topicName: process.env.GMAIL_WATCH_TOPIC!,
      });

      return NextResponse.json({
        success: true,
        message: "Gmail watch started",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to handle Gmail watch request:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
      select: {
        watchHistoryId: true,
        watchExpiration: true,
        refresh_token: true,
        access_token: true,
        providerAccountId: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "No Google account found" },
        { status: 404 }
      );
    }

    if (account.watchHistoryId && account.refresh_token) {
      const freshAccessToken = await refreshAccessToken(account.refresh_token);
      if (freshAccessToken && freshAccessToken !== account.access_token) {
        await prisma.account.update({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
          },
          data: {
            access_token: freshAccessToken,
          },
        });
      }
    }

    return NextResponse.json({
      watching: !!account.watchHistoryId,
      expiration: account.watchExpiration,
    });
  } catch (error) {
    console.error("Failed to get Gmail watch status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
