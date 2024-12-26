// import { queueService } from "@/lib/queue/queue-service";
// import { JOB_PRIORITIES } from "@/lib/queue/queue-config";
// import type { ProcessingJob } from "@/lib/queue/types";
import { prisma } from "@mailjot/database";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Verify cron secret to ensure only authorized calls
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: "Cron job processed",
    });
  } catch (error) {
    console.error("[PROCESS_SEQUENCES]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
