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
    const { name, email, title, company } = json;

    let companyId: string | undefined;

    if (company) {
      // First try to find existing company
      const existingCompany = await prisma.company.findFirst({
        where: {
          name: company.name,
          userId: session.user.id,
        },
      });

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        // Create new company if it doesn't exist
        const newCompany = await prisma.company.create({
          data: {
            name: company.name,
            website: company.website,
            userId: session.user.id,
          },
        });
        companyId = newCompany.id;
      }
    }

    const contact = await prisma.contact.create({
      data: {
        name,
        email,
        title,
        companyId,
        userId: session.user.id,
      },
      include: {
        company: true,
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
