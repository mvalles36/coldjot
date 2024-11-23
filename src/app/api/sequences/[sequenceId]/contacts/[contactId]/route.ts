import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: { sequenceId: string; contactId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { sequenceId, contactId } = params;
    const sequence = await prisma.sequence.findUnique({
      where: {
        id: sequenceId,
        userId: session.user.id,
      },
    });

    if (!sequence) {
      return new NextResponse("Not found", { status: 404 });
    }

    await prisma.sequenceContact.delete({
      where: {
        sequenceId_contactId: {
          sequenceId,
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
