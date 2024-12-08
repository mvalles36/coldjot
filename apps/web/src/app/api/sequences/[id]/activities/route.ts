import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@mailjot/database";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get("timeframe") || "7d";

    // Calculate the date range based on timeframe
    const startDate = new Date();
    switch (timeframe) {
      case "24h":
        startDate.setHours(startDate.getHours() - 24);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "all":
        startDate.setFullYear(2000); // Effectively get all data
        break;
    }

    // Get sequence contacts with their status and steps
    const sequenceContacts = await prisma.sequenceContact.findMany({
      where: {
        sequenceId: id,
        updatedAt: {
          gte: startDate,
        },
      },
      include: {
        contact: true,
        sequence: {
          include: {
            steps: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Format activities
    const activities = sequenceContacts.map((sc) => {
      const currentStep = sc.sequence.steps[sc.currentStep];
      return {
        id: sc.id,
        contactName: sc.contact.name,
        contactEmail: sc.contact.email,
        subject: currentStep?.subject || "(No subject)",
        status: sc.status,
        timestamp: sc.updatedAt,
        stepNumber: sc.currentStep + 1,
      };
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching sequence activities:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
