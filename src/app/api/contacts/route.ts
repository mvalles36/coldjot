import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const contacts = await prisma.contact.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(contacts);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    console.log("Creating contact with data:", json);

    const { name, email, title, linkedinUrl, domain, company } = json;

    // If company data is provided, create or find the company first
    let savedCompany = null;
    if (company) {
      savedCompany = await prisma.company.upsert({
        where: {
          name_userId: {
            name: company.name,
            userId: session.user.id,
          },
        },
        create: {
          name: company.name,
          website: company.website,
          domain: company.domain,
          address: company.address,
          userId: session.user.id,
        },
        update: {
          website: company.website,
          domain: company.domain,
          address: company.address,
        },
      });
    }

    // Create the contact with all fields
    const contact = await prisma.contact.create({
      data: {
        name,
        email,
        title,
        linkedinUrl,
        domain,
        companyId: savedCompany?.id || null,
        userId: session.user.id,
      },
      include: {
        company: true,
      },
    });

    return NextResponse.json(contact);
  } catch (error) {
    console.error("Failed to create contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
