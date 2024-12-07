import { auth } from "@/auth";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const settings = await prisma.devSettings.findUnique({
      where: {
        userId: session.user.id,
      },
    });

    return NextResponse.json(
      settings || { disableSending: false, testEmails: [] }
    );
  } catch (error) {
    console.error("[DEV_SETTINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const settings = await req.json();

    const updatedSettings = await prisma.devSettings.upsert({
      where: {
        userId: session.user.id,
      },
      create: {
        userId: session.user.id,
        disableSending: settings.disableSending,
        testEmails: settings.testEmails,
      },
      update: {
        disableSending: settings.disableSending,
        testEmails: settings.testEmails,
      },
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error("[DEV_SETTINGS_PUT]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
