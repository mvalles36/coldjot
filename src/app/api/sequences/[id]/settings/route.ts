import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { testMode } = await req.json();
    const { id } = await params;

    // Update sequence settings

    console.log("testMode", testMode);
    const sequence = await prisma.sequence.update({
      where: {
        id: id,
        userId: session.user.id,
      },
      data: {
        testMode: testMode,
      },
    });

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("[SEQUENCE_SETTINGS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
