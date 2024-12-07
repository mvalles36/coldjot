import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  try {
    const companies = await prisma.company.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { website: { contains: query, mode: "insensitive" } },
          { domain: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        contacts: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search companies" },
      { status: 500 }
    );
  }
}
