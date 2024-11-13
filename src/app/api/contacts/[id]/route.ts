import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const json = await request.json();
  const { name, email } = json;

  const contact = await prisma.contact.update({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    data: {
      name,
      email,
    },
  });

  return NextResponse.json(contact);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { name, email, companyId } = json;

    // Verify ownership
    const existingContact = await prisma.contact.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const contact = await prisma.contact.update({
      where: { id: params.id },
      data: {
        name,
        email,
        companyId: companyId || null,
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Failed to update contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify ownership
    const existingContact = await prisma.contact.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    });

    if (!existingContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await prisma.contact.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
