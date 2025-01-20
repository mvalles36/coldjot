import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@coldjot/database";

interface RouteParams {
  params: Promise<{
    mailboxId: string;
    aliasId: string;
  }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { mailboxId, aliasId } = await params;

    // Verify account ownership
    const account = await prisma.mailbox.findUnique({
      where: {
        id: mailboxId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const body = await req.json();
    const { name, isActive } = body;

    const alias = await prisma.emailAlias.update({
      where: {
        id: aliasId,
        mailboxId: mailboxId,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(alias);
  } catch (error) {
    console.error("[EMAIL_ALIAS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { mailboxId, aliasId } = await params;

    // Verify account ownership
    const account = await prisma.mailbox.findUnique({
      where: {
        id: mailboxId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return new NextResponse("Not Found", { status: 404 });
    }

    await prisma.emailAlias.delete({
      where: {
        id: aliasId,
        mailboxId: mailboxId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[EMAIL_ALIAS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
