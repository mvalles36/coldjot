import { auth } from "@/auth";
import { prisma } from "@coldjot/database";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const json = await req.json();
    const { name, permissions, schedule } = json;

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
