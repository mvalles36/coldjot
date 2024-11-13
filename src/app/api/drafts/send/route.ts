import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendGmailDraft } from "@/lib/gmail";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const json = await request.json();
  const { draftId } = json;

  try {
    // Get the user's account with tokens
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
      select: {
        access_token: true,
      },
    });

    if (!account?.access_token) {
      return new NextResponse("No access token found", { status: 401 });
    }

    const draft = await prisma.draft.findUnique({
      where: {
        id: draftId,
        userId: session.user.id,
      },
    });

    if (!draft) {
      return new NextResponse("Draft not found", { status: 404 });
    }

    if (!draft.gmailDraftId) {
      return new NextResponse("Gmail draft ID not found", { status: 400 });
    }

    // Send the draft using Gmail API
    await sendGmailDraft({
      accessToken: account.access_token,
      draftId: draft.gmailDraftId,
    });

    // Update the draft status in our database
    await prisma.draft.update({
      where: { id: draftId },
      data: { sent: true, sentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send draft:", error);
    return new NextResponse("Failed to send draft", { status: 500 });
  }
}
