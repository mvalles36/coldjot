import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const companies = await prisma.company.findMany({
      where: {
        userId: session.user.id,
        name: {
          contains: query,
          mode: "insensitive", // Case-insensitive search
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 5, // Limit results
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error("Error searching companies:", error);
    return NextResponse.json(
      { error: "Failed to search companies" },
      { status: 500 }
    );
  }
}
