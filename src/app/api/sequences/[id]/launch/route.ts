import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processSequences } from "@/lib/cron/sequence-processor";
import { NextResponse } from "next/server";

export async function POST(
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

    // Update sequence status and test mode
    await prisma.sequence.update({
      where: {
        id: id,
        userId: session.user.id,
      },
      data: {
        status: "active",
        testMode: testMode,
      },
    });

    // Trigger initial processing
    await processSequences();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEQUENCE_LAUNCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
