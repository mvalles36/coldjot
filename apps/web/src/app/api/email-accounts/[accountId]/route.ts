import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@coldjot/database";

interface RouteParams {
  params: Promise<{
    accountId: string;
  }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { accountId } = await params;
    const account = await prisma.emailAccount.findUnique({
      where: {
        id: accountId,
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

    const { accountId } = await params;
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
      await prisma.emailAccount.updateMany({
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
    const currentAccount = await prisma.emailAccount.findUnique({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!currentAccount) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Merge existing settings with new settings
    const mergedSettings = {
      ...(currentAccount.settings as Record<string, unknown>),
      ...(newSettings || {}),
    };

    // If defaultAliasId is provided, verify it belongs to this account
    if (defaultAliasId !== undefined) {
      // Only verify if defaultAliasId is not null (null means use primary email)
      if (defaultAliasId !== null) {
        const alias = await prisma.emailAlias.findUnique({
          where: {
            id: defaultAliasId,
            emailAccountId: accountId,
          },
        });

        if (!alias) {
          return new NextResponse("Invalid alias ID", { status: 400 });
        }
      }
    }

    const account = await prisma.emailAccount.update({
      where: {
        id: accountId,
        userId: session.user.id,
      },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(isDefault !== undefined && { isDefault }),
        ...(name !== undefined && { name }),
        ...(newSettings !== undefined && { settings: mergedSettings }),
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

    const { accountId } = await params;

    await prisma.emailAccount.delete({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[EMAIL_ACCOUNT_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
