import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: { sequenceId: string; stepId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { sequenceId } = await params;
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: sequenceId,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    const json = await req.json();
    const { stepId } = await params;
    const step = await prisma.sequenceStep.update({
      where: { id: stepId },
      data: json,
    });

    return NextResponse.json(step);
  } catch (error) {
    console.error("[SEQUENCE_STEP_UPDATE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; stepId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }
    const { stepId } = await params;
    await prisma.sequenceStep.delete({
      where: { id: stepId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEQUENCE_STEP_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
