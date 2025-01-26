import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check if user is authenticated and is admin
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  // Get user from database to check admin status
  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });

  if (user?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Prevent deleting yourself
  if (user.id === id) {
    return new NextResponse("Cannot delete yourself", { status: 400 });
  }

  // Delete user
  await prisma.user.delete({
    where: { id: id },
  });

  return new NextResponse(null, { status: 204 });
}
