import { Queue, Job } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { logger } from "@/lib/log";
import { prisma } from "@mailjot/database";
import { emailSchedulingService } from "@/services/schedule/email-scheduling-service";

export class ScheduleProcessor extends BaseProcessor<any> {
  constructor(queue: Queue) {
    super(queue, "schedule", {
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

  protected async process(job: Job<any>): Promise<void> {
    try {
      await emailSchedulingService.checkNextScheduledEmail();
    } catch (error) {
      logger.error(`Failed to process schedule job ${job.id}:`, error);
      throw error;
    }
  }
}
