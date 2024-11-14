import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fallbacks = await prisma.placeholderFallback.findMany({
      where: { userId: session.user.id },
    });
    return NextResponse.json(fallbacks);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch fallbacks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, value } = body;

    const fallback = await prisma.placeholderFallback.upsert({
      where: {
        userId_name: {
          userId: session.user.id,
          name: name,
        },
      },
      update: { value },
      create: {
        userId: session.user.id,
        name,
        value,
      },
    });

    return NextResponse.json(fallback);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save fallback" },
      { status: 500 }
    );
  }
}
