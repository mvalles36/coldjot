import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@coldjot/database";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const accounts = await prisma.mailbox.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        aliases: true,
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("[EMAIL_ACCOUNTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { email, name, isDefault } = body;

    if (!email) {
      return new NextResponse("Email is required", { status: 400 });
    }

    // If this is set as default, unset any existing default
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

    const account = await prisma.mailbox.create({
      data: {
        email,
        name,
        isDefault,
        provider: "manual", // Default provider for manually added accounts
        userId: session.user.id,
      },
      include: {
        aliases: true,
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    console.error("[EMAIL_ACCOUNTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
