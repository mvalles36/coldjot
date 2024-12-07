import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { refreshAccessToken } from "@/lib/google/google-account";
import { sendGmailDraft } from "@/lib/google/gmail";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const json = await request.json();
  const { draftId } = json;

  try {
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

    if (!account?.access_token || !account?.refresh_token) {
      return NextResponse.json(
        { error: "No access token found" },
        { status: 401 }
      );
    }

    const draft = await prisma.draft.findUnique({
      where: {
        id: draftId,
        userId: userId,
      },
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (!draft.gmailDraftId) {
      return NextResponse.json(
        { error: "Gmail draft ID not found" },
        { status: 400 }
      );
    }

    try {
      // Try to send with current token
      await sendGmailDraft({
        accessToken: account.access_token,
        draftId: draft.gmailDraftId,
      });
    } catch (error: any) {
      if (error.message === "TOKEN_EXPIRED") {
        // Refresh token and retry
        // const newAccessToken = await refreshAccessToken(account.refresh_token);
        console.log(`2️⃣ Refreshing access token point`);
        const newAccessToken = await refreshAccessToken(
          userId,
          account.refresh_token
        );

        // await prisma.account.update({
        //   where: {
        //     provider_providerAccountId: {
        //       provider: "google",
        //       providerAccountId: account.providerAccountId,
        //     },
        //   },
        //   data: {
        //     access_token: newAccessToken,
        //   },
        // });

        // Retry with new token
        await sendGmailDraft({
          accessToken: newAccessToken as string,
          draftId: draft.gmailDraftId,
        });
      } else {
        throw error;
      }
    }

    // Update the draft status in our database
    await prisma.draft.update({
      where: { id: draftId },
      data: { sent: true, sentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send draft:", error);
    return NextResponse.json(
      { error: "Failed to send draft" },
      { status: 500 }
    );
  }
}
