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
    const { name, email, companyId, companyName, title } = json;

    // If companyName is provided, create or find the company first
    let company = null;
    if (companyName) {
      company = await prisma.company.upsert({
        where: {
          name_userId: {
            name: companyName,
            userId: session.user.id,
          },
        },
        create: {
          name: companyName,
          userId: session.user.id,
        },
        update: {},
      });
    }

    console.log("Person Data:", json);

    const contact = await prisma.contact.create({
      data: {
        name,
        email,
        companyId: company?.id || companyId || null,
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
