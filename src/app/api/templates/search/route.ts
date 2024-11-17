import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          //   { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 20,
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
