import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lists = await prisma.emailList.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        contacts: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error("Failed to fetch lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch lists" },
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
    const { name, description, contacts, tags } = json;

    const list = await prisma.emailList.create({
      data: {
        name,
        description,
        tags: tags || [],
        userId: session.user.id,
        contacts: {
          connect: contacts.map((id: string) => ({ id })),
        },
      },
      include: {
        contacts: true,
      },
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to create list:", error);
    return NextResponse.json(
      { error: "Failed to create list" },
      { status: 500 }
    );
  }
}
