import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Check if user is authenticated and is admin
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Get user from database to check admin status
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });

  if (user?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Fetch all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json(users);
}
