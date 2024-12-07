import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const templates = await prisma.template.findMany({
    where: {
      userId: session.user.id,
    },
    include: {},
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const { name, content, subject } = json;

  const template = await prisma.template.create({
    data: {
      name,
      content,
      subject,
      userId: session.user.id,
    },
    include: {},
  });

  return NextResponse.json(template);
}
