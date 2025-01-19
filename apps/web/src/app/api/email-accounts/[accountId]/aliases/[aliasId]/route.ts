import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@coldjot/database";

interface RouteParams {
  params: {
    accountId: string;
    aliasId: string;
  };
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Verify account ownership
    const account = await prisma.emailAccount.findUnique({
      where: {
        id: params.accountId,
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
        id: params.aliasId,
        emailAccountId: params.accountId,
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

    // Verify account ownership
    const account = await prisma.emailAccount.findUnique({
      where: {
        id: params.accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return new NextResponse("Not Found", { status: 404 });
    }

    await prisma.emailAlias.delete({
      where: {
        id: params.aliasId,
        emailAccountId: params.accountId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[EMAIL_ALIAS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
