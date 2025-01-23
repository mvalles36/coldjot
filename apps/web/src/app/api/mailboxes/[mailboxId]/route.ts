import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@coldjot/database";

interface RouteParams {
  params: Promise<{
    mailboxId: string;
  }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { mailboxId } = await params;
    const account = await prisma.mailbox.findUnique({
      where: {
        id: mailboxId,
        userId: session.user.id,
      },
      include: {
        aliases: true,
      },
    });

    if (!account) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error("[EMAIL_ACCOUNT_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { mailboxId } = await params;
    const body = await req.json();
    const {
      isActive,
      isDefault,
      name,
      settings: newSettings,
      defaultAliasId,
    } = body;

    // If setting as default, unset any existing default
    if (isDefault) {
      await prisma.mailbox.updateMany({
        where: {
          userId: session.user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Get current account to merge settings
    const currentAccount = await prisma.mailbox.findUnique({
      where: {
        id: mailboxId,
        userId: session.user.id,
      },
    });

    if (!currentAccount) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // If defaultAliasId is provided, verify it belongs to this account
    if (defaultAliasId !== undefined) {
      // Only verify if defaultAliasId is not null (null means use primary email)
      if (defaultAliasId !== null) {
        const alias = await prisma.emailAlias.findUnique({
          where: {
            id: defaultAliasId,
            mailboxId: mailboxId,
          },
        });

        if (!alias) {
          return new NextResponse("Invalid alias ID", { status: 400 });
        }
      }
    }

    const account = await prisma.mailbox.update({
      where: {
        id: mailboxId,
        userId: session.user.id,
      },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
        ...(name !== undefined && { name }),
        ...(defaultAliasId !== undefined && { defaultAliasId }),
      },
      include: {
        aliases: true,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("[EMAIL_ACCOUNT_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { mailboxId } = await params;

    await prisma.mailbox.delete({
      where: {
        id: mailboxId,
        userId: session.user.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[EMAIL_ACCOUNT_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
