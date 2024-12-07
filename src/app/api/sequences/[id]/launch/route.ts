import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sequenceProcessor } from "@/lib/sequence/sequence-processor";
import { queueService } from "@/lib/queue/queue-service";
import { JOB_PRIORITIES } from "@/lib/queue/queue-config";
import type { ProcessingJob } from "@/lib/queue/types";
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

    // Initialize queue service if not already initialized
    await queueService.initialize();

    // Create a processing job for the sequence
    const processingJob: ProcessingJob = {
      id: `sequence-${id}-${Date.now()}`,
      priority: JOB_PRIORITIES.HIGH,
      timestamp: new Date(),
      userId: session.user.id,
      type: "sequence",
      data: {
        sequenceId: id,
        scheduleType: "business", // This will be updated based on sequence settings
      },
    };

    // Add the job to the processing queue
    await queueService.addProcessingJob(processingJob);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SEQUENCE_LAUNCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
