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

    const { action } = await req.json();
    const { sequenceId } = await params;

    if (!["pause", "resume"].includes(action)) {
      return new NextResponse("Invalid action", { status: 400 });
    }

    // Update sequence status
    const sequence = await prisma.sequence.update({
      where: {
        id: sequenceId,
        userId: session.user.id,
      },
      data: {
        status: action === "pause" ? "paused" : "active",
      },
    });

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("[SEQUENCE_CONTROL_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
