import { NextRequest, NextResponse } from "next/server";
import { setupGmailWatch, stopGmailWatch } from "@/lib/google/gmail-watch";
import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
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
          userId: true,
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

      // const freshAccessToken = await refreshAccessToken(account.refresh_token);
      console.log(`4️⃣ Refreshing access token point`);
      const newAccessToken = await refreshAccessToken(
        account.userId,
        account.refresh_token
      );

      if (!newAccessToken) {
        return NextResponse.json(
          { error: "Failed to refresh access token" },
          { status: 401 }
        );
      }

      await setupGmailWatch({
        userId: session.user.id,
        accessToken: newAccessToken,
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
        userId: true,
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
