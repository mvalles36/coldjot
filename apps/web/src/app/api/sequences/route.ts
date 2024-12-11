import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";
import { sequenceProcessor } from "@/lib/sequence/sequence-processor";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const json = await req.json();
    const { name, permissions, schedule, autoLaunch = false } = json;

    const sequence = await prisma.sequence.create({
      data: {
        name,
        accessLevel: permissions,
        scheduleType: schedule,
        status: "draft",
        userId: session.user.id,
      },
      include: {
        steps: true,
        contacts: true,
      },
    });

    // If autoLaunch is true and sequence has steps and contacts, launch it
    await sequenceProcessor.launchSequence(sequence.id, session.user.id);

    if (
      autoLaunch &&
      sequence.steps.length > 0 &&
      sequence.contacts.length > 0
    ) {
      try {
        console.log("Launching sequence", sequence.id);
        await sequenceProcessor.launchSequence(sequence.id, session.user.id);
      } catch (error) {
        console.error("[SEQUENCE_LAUNCH_ERROR]", error);
        // Don't throw here, just log the error as the sequence was created successfully
      }
    }

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("[SEQUENCES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const sequences = await prisma.sequence.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        steps: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            contacts: true,
          },
        },
      },
    });

    return NextResponse.json(sequences);
  } catch (error) {
    console.error("[SEQUENCES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
