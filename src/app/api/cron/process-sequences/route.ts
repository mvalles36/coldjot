import { processSequences } from "@/lib/cron/sequence-processor";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Verify cron secret to ensure only authorized calls
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await processSequences();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PROCESS_SEQUENCES]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
