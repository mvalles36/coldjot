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

    const { listId } = await req.json();
    const sequenceId = params.sequenceId;

    // Verify sequence ownership
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: sequenceId,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Get contacts from the list
    const list = await prisma.emailList.findUnique({
      where: {
        id: listId,
        userId: session.user.id,
      },
      include: {
        contacts: true,
      },
    });

    if (!list) {
      return new NextResponse("List not found", { status: 404 });
    }

    // Add contacts to sequence
    const results = await prisma.$transaction(
      list.contacts.map((contact) =>
        prisma.sequenceContact.upsert({
          where: {
            sequenceId_contactId: {
              sequenceId,
              contactId: contact.id,
            },
          },
          create: {
            sequenceId,
            contactId: contact.id,
            status: "not_sent",
          },
          update: {},
          include: {
            contact: {
              include: {
                company: true,
              },
            },
          },
        })
      )
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("[SEQUENCE_CONTACTS_LIST_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
