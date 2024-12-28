import { Queue, Job } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { logger } from "@/lib/log";
import { prisma } from "@mailjot/database";
import { contactProcessingService } from "@/services/contact/contact-processing-service";

export class ContactProcessor extends BaseProcessor<any> {
  constructor(queue: Queue) {
    super(queue, "contact", {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000, // 1 second
      },
      connection: {
        // maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
  }

  protected async process(job: Job<any>): Promise<void> {
    try {
      await contactProcessingService.processNewContacts();
    } catch (error) {
      logger.error(`Failed to process contact job ${job.id}:`, error);
      throw error;
    }
  }
}

// Export factory function for service manager
export function createContactProcessor(queue: Queue): ContactProcessor {
  return new ContactProcessor(queue);
}
