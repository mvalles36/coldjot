import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const json = await request.json();
  const { name, content, sections } = json;

  // Delete existing sections and create new ones
  await prisma.templateSection.deleteMany({
    where: {
      templateId: params.id,
    },
  });

  const template = await prisma.template.update({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    data: {
      name,
      content,
      sections: {
        create: sections.map((section: any, index: number) => ({
          name: section.name,
          content: section.content,
          order: index,
        })),
      },
    },
    include: {
      sections: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await prisma.template.delete({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  });

  return new NextResponse(null, { status: 204 });
}
