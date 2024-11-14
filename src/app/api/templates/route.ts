import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  const { name, content, sections, variables } = json;

  const template = await prisma.template.create({
    data: {
      name,
      content,
      userId: session.user.id,
    },
    include: {},
  });

  return NextResponse.json(template);
}
