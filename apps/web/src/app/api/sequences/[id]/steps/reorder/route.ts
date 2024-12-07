import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { steps } = await req.json();
    const { id } = params;

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

    // Update all steps in a transaction
    await prisma.$transaction(
      steps.map((step: any) =>
        prisma.sequenceStep.update({
          where: { id: step.id },
          data: {
            order: step.order,
            previousStepId: step.previousStepId,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEQUENCE_STEPS_REORDER]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
