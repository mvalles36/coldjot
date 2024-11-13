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
  const { name, email } = json;

  const contact = await prisma.contact.update({
    where: {
      id: params.id,
      userId: session.user.id,
    },
    data: {
      name,
      email,
    },
  });

  return NextResponse.json(contact);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  await prisma.contact.delete({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  });

  return new NextResponse(null, { status: 204 });
}
