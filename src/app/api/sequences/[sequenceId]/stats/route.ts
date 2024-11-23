import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { StepStatus } from "@/types/sequences";

interface SequenceContactWithStatus {
  status: StepStatus;
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
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: sequenceId,
        userId: session.user.id,
      },
      include: {
        steps: true,
        stats: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Calculate stats
    const stats = sequence.stats.reduce(
      (acc, stat) => {
        switch (stat.status) {
          case "not_sent":
            acc.active++;
            acc.notSent++;
            break;
          case "scheduled":
            acc.paused++;
            acc.scheduled++;
            break;
          case "sent":
            acc.finished++;
            acc.delivered++;
            break;
          case "bounced":
            acc.bounced++;
            break;
          case "replied":
            acc.replied++;
            break;
          case "interested":
            acc.interested++;
            break;
          case "opted_out":
            acc.optedOut++;
            break;
        }
        return acc;
      },
      {
        active: 0,
        paused: 0,
        finished: 0,
        bounced: 0,
        notSent: 0,
        scheduled: 0,
        delivered: 0,
        replied: 0,
        interested: 0,
        optedOut: 0,
      }
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[SEQUENCE_STATS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
