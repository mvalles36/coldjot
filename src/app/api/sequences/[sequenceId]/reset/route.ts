import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { sequenceId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { sequenceId } = params;

    // Verify sequence ownership
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: sequenceId,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Reset sequence and all its contacts
    await prisma.$transaction([
      // Reset sequence status
      prisma.sequence.update({
        where: { id: sequenceId },
        data: {
          status: "draft",
        },
      }),
      // Reset all sequence contacts
      prisma.sequenceContact.updateMany({
        where: { sequenceId },
        data: {
          status: "not_sent",
          currentStep: 0,
          lastProcessedAt: null,
          completedAt: null,
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
