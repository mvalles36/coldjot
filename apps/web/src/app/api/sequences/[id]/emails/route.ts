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
        startDate.setFullYear(2000);
        break;
    }

    // Get the sequence with its steps
    const sequence = await prisma.sequence.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!sequence) {
      return new NextResponse("Sequence not found", { status: 404 });
    }

    const totalSteps = sequence.steps.length;

    // Get sequence progress records with contact information
    const progressRecords = await prisma.sequenceContact.findMany({
      where: {
        sequenceId: id,
        updatedAt: {
          gte: startDate,
        },
      },
      include: {
        contact: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Get the latest email events for reference
    const emailEvents = await prisma.emailEvent.findMany({
      where: {
        sequenceId: id,
        contactId: {
          in: progressRecords.map((record) => record.contactId),
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    // Create a map of contactId to their latest email event
    const latestEventsByContact = emailEvents.reduce((acc, event) => {
      if (
        !acc.has(event.contactId!) ||
        acc.get(event.contactId!)!.timestamp < event.timestamp
      ) {
        acc.set(event.contactId!, event);
      }
      return acc;
    }, new Map<string, (typeof emailEvents)[0]>());

    // Format activities using progress records
    const activities = progressRecords.map((record) => {
      const currentStep = sequence.steps[record.currentStep];
      const latestEvent = latestEventsByContact.get(record.contactId);

      // Determine status based on progress record and latest event
      let status: "not_started" | "in_progress" | "completed" | "failed";

      if (record.completed) {
        status = "completed";
      } else if (latestEvent?.type.toLowerCase() === "bounced") {
        status = "failed";
      } else if (record.currentStep > 0) {
        status = "in_progress";
      } else {
        status = "not_started";
      }

      return {
        id: record.id,
        contactName: record.contact.name,
        contactEmail: record.contact.email,
        subject: currentStep?.subject || "(No subject)",
        status,
        timestamp: record.updatedAt,
        stepNumber: record.currentStep,
        totalSteps,
        stepName:
          currentStep?.stepType === "manual_email"
            ? "Manual Email"
            : currentStep?.subject || "Email",
        nextScheduledAt: record.nextScheduledAt,
        lastProcessedAt: record.lastProcessedAt,
      };
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching sequence activities:", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
