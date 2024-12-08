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

    // Initialize queue service
    // await queueService.initialize();

    // Get all active sequences
    // const activeSequences = await prisma.sequence.findMany({
    //   where: {
    //     status: "active",
    //   },
    //   select: {
    //     id: true,
    //     userId: true,
    //     scheduleType: true,
    //   },
    // });

    // // Create processing jobs for each active sequence
    // const jobs = activeSequences.map(
    //   (sequence): ProcessingJob => ({
    //     id: `sequence-${sequence.id}-${Date.now()}`,
    //     priority: JOB_PRIORITIES.NORMAL,
    //     timestamp: new Date(),
    //     userId: sequence.userId,
    //     type: "sequence",
    //     data: {
    //       sequenceId: sequence.id,
    //       scheduleType: sequence.scheduleType as "business" | "custom",
    //     },
    //   })
    // );

    // // Add all jobs to the processing queue
    // await Promise.all(jobs.map((job) => queueService.addProcessingJob(job)));

    // return NextResponse.json({
    //   success: true,
    //   processed: jobs.length,
    // });

    return NextResponse.json({
      success: true,
      message: "Cron job processed",
    });
  } catch (error) {
    console.error("[PROCESS_SEQUENCES]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
