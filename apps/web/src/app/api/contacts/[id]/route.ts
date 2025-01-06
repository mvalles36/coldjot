import { auth } from "@/auth";
import { prisma } from "@coldjot/database";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contactId = id;

  try {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
      include: { company: true },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contactId = id;
  const data = await request.json();

  try {
    const updatedContact = await prisma.contact.update({
      where: {
        id: contactId,
        userId: session.user.id,
      },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        linkedinUrl: data.linkedinUrl,
        companyId: data.companyId,
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json(updatedContact);
  } catch (error) {
    console.error("Error updating contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contactId = id;
  const data = await request.json();

  try {
    // First fetch the existing contact to get current values
    const existingContact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    if (!existingContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Then update with new values
    const updatedContact = await prisma.contact.update({
      where: {
        id: contactId,
        userId: session.user.id,
      },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...((data.firstName !== undefined || data.lastName !== undefined) && {
          name: `${data.firstName ?? existingContact.firstName} ${
            data.lastName ?? existingContact.lastName
          }`,
        }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.linkedinUrl !== undefined && {
          linkedinUrl: data.linkedinUrl,
        }),
        ...(data.companyId !== undefined && { companyId: data.companyId }),
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json(updatedContact);
  } catch (error) {
    console.error("Error patching contact:", error);
    return NextResponse.json(
      { error: "Failed to patch contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const contactId = id;

  try {
    console.log("contactId", contactId);
    console.log("session.user.id", session.user.id);

    const deletedContact = await prisma.contact.delete({
      where: {
        id: contactId,
        userId: session.user.id,
      },
    });

    console.log("deletedContact", deletedContact);

    if (!deletedContact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deletedContact });
  } catch (error) {
    console.error("Error deleting contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
