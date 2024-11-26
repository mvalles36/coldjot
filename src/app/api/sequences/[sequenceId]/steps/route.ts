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

    const { sequenceId } = await params;
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: sequenceId,
        userId: session.user.id,
      },
      include: {
        steps: true,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    const json = await req.json();
    const {
      type,
      timing,
      priority,
      delayAmount,
      delayUnit,
      subject,
      content,
      includeSignature,
      note,
      replyToThread,
    } = json;

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        stepType: type,
        status: "not_sent",
        timing,
        priority,
        delayAmount,
        delayUnit,
        subject,
        content,
        includeSignature,
        note,
        order: sequence.steps.length,
        replyToThread,
      },
    });

    return NextResponse.json(step);
  } catch (error) {
    console.error("[SEQUENCE_STEPS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: { sequenceId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { sequenceId } = await params;
    const steps = await prisma.sequenceStep.findMany({
      where: {
        sequenceId: sequenceId,
        sequence: {
          userId: session.user.id,
        },
      },
      orderBy: {
        order: "asc",
      },
    });

    return NextResponse.json(steps);
  } catch (error) {
    console.error("[SEQUENCE_STEPS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
