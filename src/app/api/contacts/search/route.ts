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

  console.log("Search query:", query);

  try {
    // Split the search query into terms and remove empty strings
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

    // If no valid search terms, return empty array
    if (searchTerms.length === 0) {
      return NextResponse.json([]);
    }

    const contacts = await prisma.contact.findMany({
      where: {
        userId: session.user.id,
        OR: searchTerms.map((term) => ({
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
            {
              company: {
                name: { contains: term, mode: "insensitive" },
              },
            },
          ],
        })),
      },
      include: {
        company: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 10,
    });

    console.log("Found contacts:", contacts.length);
    return NextResponse.json(contacts);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
