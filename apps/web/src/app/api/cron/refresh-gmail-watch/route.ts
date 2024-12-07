import { NextResponse } from "next/server";
import { prisma } from "@mailjot/database";
import { refreshGmailWatch } from "@/lib/google/gmail-watch";

export async function GET(req: Request) {
  try {
    // Find accounts where watch is about to expire
    const accounts = await prisma.account.findMany({
      where: {
        provider: "google",
        watchExpiration: {
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day before expiration
        },
      },
      select: {
        userId: true,
      },
    });

    // Refresh watch for each account
    for (const account of accounts) {
      try {
        await refreshGmailWatch(account.userId);
        console.log(`Refreshed Gmail watch for user ${account.userId}`);
      } catch (error) {
        console.error(
          `Failed to refresh Gmail watch for user ${account.userId}:`,
          error
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in refresh-gmail-watch cron:", error);
    return NextResponse.json(
      { error: "Failed to refresh watches" },
      { status: 500 }
    );
  }
}
