import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

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

    // Get sequence contacts with their latest status and events
    const sequenceContacts = await prisma.sequenceContact.findMany({
      where: {
        sequenceId: id,
        sequence: {
          userId: session.user.id,
        },
      },
      include: {
        contact: {
          include: {
            company: true,
          },
        },
        // sequence: {
        // include: {
        // steps: {
        //   orderBy: {
        //     order: "asc",
        //   },
        // },
        // },
        // },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Get the latest email events for all contacts
    // const emailEvents = await prisma.emailEvent.findMany({
    //   where: {
    //     sequenceId: id,
    //     contactId: {
    //       in: sequenceContacts.map((contact) => contact.contactId),
    //     },
    //   },
    //   orderBy: {
    //     timestamp: "desc",
    //   },
    // });

    // Create a map of contactId to their latest email event
    // const latestEventsByContact = emailEvents.reduce((acc, event) => {
    //   if (
    //     !acc.has(event.contactId!) ||
    //     acc.get(event.contactId!)!.timestamp < event.timestamp
    //   ) {
    //     acc.set(event.contactId!, event);
    //   }
    //   return acc;
    // }, new Map<string, (typeof emailEvents)[0]>());

    // Format contacts with their latest status and activity
    const enrichedContacts = sequenceContacts.map((contact) => {
      const currentStep = sequence.steps[contact.currentStep];
      // const latestEvent = latestEventsByContact.get(contact.contactId);

      // Determine status based on contact record and latest event
      let status: "not_started" | "in_progress" | "completed" | "failed";

      if (contact.completed) {
        status = "completed";
        // } else if (latestEvent?.type.toLowerCase() === "bounced") {
      } else if (contact.status === "bounced") {
        status = "failed";
      } else if (contact.currentStep > 0) {
        status = "in_progress";
      } else {
        status = "not_started";
      }

      return {
        ...contact,
        status,
      };
    });

    return NextResponse.json({
      contacts: enrichedContacts,
      totalSteps: sequence.steps.length,
    });
  } catch (error) {
    console.error("[SEQUENCE_CONTACTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { contactId } = await req.json();
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

    const sequenceContact = await prisma.sequenceContact.create({
      data: {
        sequenceId: id,
        contactId,
        status: "not_started",
        currentStep: 0,
      },
      include: {
        contact: {
          include: {
            company: true,
          },
        },
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
    });

    // Return the contact with the same enriched format as GET
    const enrichedContact = {
      ...sequenceContact,
      status: "not_started" as const,
      currentStepName: sequenceContact.sequence.steps[0]?.subject || "Email",
      totalSteps: sequenceContact.sequence.steps.length,
      latestEvent: null,
    };

    return NextResponse.json(enrichedContact);
  } catch (error) {
    console.error("[SEQUENCE_CONTACTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
