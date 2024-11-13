import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const { name, content, sections, variables } = json;

  // Delete existing sections and variables
  await Promise.all([
    prisma.templateSection.deleteMany({
      where: {
        templateId: id,
      },
    }),
    prisma.templateVariable.deleteMany({
      where: {
        templateId: id,
      },
    }),
  ]);

  const template = await prisma.template.update({
    where: {
      id: id,
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
      variables: {
        create: variables.map((variable: any) => ({
          name: variable.name,
          label: variable.label,
        })),
      },
    },
    include: {
      sections: {
        orderBy: {
          order: "asc",
        },
      },
      variables: true,
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.template.delete({
    where: {
      id: id,
      userId: session.user.id,
    },
  });

  return new NextResponse(null, { status: 204 });
}
