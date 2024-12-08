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
      },
    });

    return NextResponse.json(sequenceContacts);
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
        status: "not_sent",
      },
      include: {
        contact: {
          include: {
            company: true,
          },
        },
      },
    });

    return NextResponse.json(sequenceContact);
  } catch (error) {
    console.error("[SEQUENCE_CONTACTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
