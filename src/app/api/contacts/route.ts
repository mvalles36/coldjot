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
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const json = await request.json();
  const { name, email } = json;

  if (!name || !email) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      name,
      email,
      userId: session.user.id,
    },
  });

  return NextResponse.json(contact);
}
