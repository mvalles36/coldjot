import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  req: Request,
  { params }: { params: { sequenceId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { steps } = await req.json();

    // Verify sequence ownership
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: params.sequenceId,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Update all steps in a transaction
    await prisma.$transaction(
      steps.map((step: { id: string; order: number }) =>
        prisma.sequenceStep.update({
          where: { id: step.id },
          data: { order: step.order },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEQUENCE_STEPS_REORDER]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
