import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    // Verify sequence ownership
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Reset sequence and all related data
    await prisma.$transaction([
      // Reset sequence status
      prisma.sequence.update({
        where: { id },
        data: {
          status: "draft",
          testMode: false,
        },
      }),

      // Reset all sequence contacts
      prisma.sequenceContact.updateMany({
        where: { sequenceId: id },
        data: {
          status: "not_sent",
          currentStep: 0,
          lastProcessedAt: null,
          completedAt: null,
          threadId: null,
        },
      }),

      // Reset sequence stats
      prisma.sequenceStats.updateMany({
        where: { sequenceId: id },
        data: {
          totalEmails: 0,
          sentEmails: 0,
          openedEmails: 0,
          clickedEmails: 0,
          repliedEmails: 0,
          bouncedEmails: 0,
          // openRate: 0,
          // clickRate: 0,
          // replyRate: 0,
          // bounceRate: 0,
          uniqueOpens: 0,
        },
      }),

      // Delete all email events
      prisma.emailEvent.deleteMany({
        where: { sequenceId: id },
      }),

      // Delete all email threads
      prisma.emailThread.deleteMany({
        where: { sequenceId: id },
      }),

      // Reset sequence steps
      prisma.sequenceStep.updateMany({
        where: { sequenceId: id },
        data: {
          status: "not_sent",
          threadId: null,
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEQUENCE_RESET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
