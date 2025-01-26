import { auth } from "@/auth";
import { prisma } from "@coldjot/database";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const where = {
      userId: session.user.id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const contacts = await prisma.contact.findMany({
      where: where as any, // Type assertion to bypass TypeScript error
      include: {},
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("[CONTACTS_GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const json = await req.json();
    const { firstName, lastName, name, email, title } = json;

    console.log("[CONTACT_POST]", json);

    // Before creating, check if the contact already exists
    const existingContact = await prisma.contact.findUnique({
      where: { email },
    });

    if (existingContact) {
      return NextResponse.json(existingContact);
    }

    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        name: name || `${firstName} ${lastName}`,
        email,
        userId: session.user.id,
      },
      include: {},
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("[CONTACT_POST]", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
