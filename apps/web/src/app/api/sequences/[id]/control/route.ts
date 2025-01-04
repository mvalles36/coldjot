import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { SequenceStatus } from "@mailjot/types";
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

    const { action } = await req.json();
    const { id } = await params;

    if (![SequenceStatus.PAUSED, SequenceStatus.ACTIVE].includes(action)) {
      return new NextResponse("Invalid action", { status: 400 });
    }

    // Update sequence status
    const sequence = await prisma.sequence.update({
      where: {
        id: id,
        userId: session.user.id,
      },
      data: {
        status:
          action === SequenceStatus.PAUSED
            ? SequenceStatus.PAUSED
            : SequenceStatus.ACTIVE,
      },
    });

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("[SEQUENCE_CONTROL_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
