import { Queue, Job } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { logger } from "@/lib/log";
import { prisma } from "@mailjot/database";
import { ThreadCheckData } from "@mailjot/types";
import { threadProcessor } from "@/services/thread/thread-processor";

export class ThreadProcessor extends BaseProcessor<ThreadCheckData> {
  constructor(queue: Queue) {
    super(queue, "thread", {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000, // 1 second
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
  }

  protected async process(job: Job<ThreadCheckData>): Promise<void> {
    try {
      await threadProcessor.processThread(job.data);
    } catch (error) {
      logger.error(`Failed to process thread job ${job.id}:`, error);
      throw error;
    }
  }
}
