import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contacts = await prisma.contact.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        company: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { firstName, lastName, email, linkedinUrl, companyId } = json;

    // Basic validation
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create contact data object
    const contactData = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email,
      linkedinUrl,
      userId: session.user.id,
    };

    // Only add companyId if it exists and is not null/undefined
    if (companyId) {
      // Verify the company exists and belongs to the user
      const company = await prisma.company.findFirst({
        where: {
          id: companyId,
          userId: session.user.id,
        },
      });

      if (!company) {
        return NextResponse.json(
          { error: "Invalid company selected" },
          { status: 400 }
        );
      }

      Object.assign(contactData, { companyId });
    }

    // Create the contact
    const contact = await prisma.contact.create({
      data: contactData,
      include: {
        company: true, // Always include company data in response, even if null
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
