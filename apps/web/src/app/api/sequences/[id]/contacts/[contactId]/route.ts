import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id, contactId } = await params;
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    await prisma.sequenceContact.delete({
      where: {
        sequenceId_contactId: {
          sequenceId: id,
          contactId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEQUENCE_CONTACT_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
