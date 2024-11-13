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
    include: {
      sections: {
        orderBy: {
          order: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const json = await request.json();
  const { name, content, sections } = json;

  const template = await prisma.template.create({
    data: {
      name,
      content,
      userId: session.user.id,
      sections: {
        create: sections.map((section: any, index: number) => ({
          name: section.name,
          content: section.content,
          order: index,
        })),
      },
    },
    include: {
      sections: true,
    },
  });

  return NextResponse.json(template);
}
