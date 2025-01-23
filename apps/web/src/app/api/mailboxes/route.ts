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
