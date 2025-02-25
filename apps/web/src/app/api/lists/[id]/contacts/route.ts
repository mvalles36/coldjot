import { auth } from "@/auth";
import { prisma } from "@coldjot/database";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { contactId } = await request.json();

    // Verify list ownership
    const list = await prisma.emailList.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    // Add contact to list
    const updatedList = await prisma.emailList.update({
      where: {
        id: id,
      },
      data: {
        contacts: {
          connect: {
            id: contactId,
          },
        },
      },
      include: {
        contacts: true,
        _count: {
          select: {
            contacts: true,
          },
        },
      },
    });

    return NextResponse.json(updatedList);
  } catch (error) {
    console.error("Failed to add contact to list:", error);
    return NextResponse.json(
      { error: "Failed to add contact to list" },
      { status: 500 }
    );
  }
}
