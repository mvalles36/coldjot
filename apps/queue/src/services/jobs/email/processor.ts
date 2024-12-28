import { Job, Queue } from "bullmq";
import { BaseProcessor } from "../base-processor";
import { logger } from "@/lib/log";

interface EmailJobData {
  type: "send" | "schedule";
  data: {
    to: string;
    subject: string;
    body: string;
    sequenceId?: string;
    contactId?: string;
    metadata?: Record<string, any>;
  };
}

export class EmailProcessor extends BaseProcessor<EmailJobData> {
  constructor(queue: Queue) {
    super(queue, "email", {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000, // 1 second
      },
    });
  }

  protected async process(job: Job<EmailJobData>): Promise<void> {
    const { type, data } = job.data;

    try {
      switch (type) {
        case "send":
          await this.handleSendEmail(job, data);
          break;
        case "schedule":
          await this.handleScheduleEmail(job, data);
          break;
        default:
          throw new Error(`Unknown email job type: ${type}`);
      }
    } catch (error) {
      logger.error(`Failed to process email job ${job.id}:`, error);
      throw error;
    }
  }

  private async handleSendEmail(
    job: Job<EmailJobData>,
    data: EmailJobData["data"]
  ): Promise<void> {
    try {
      // Update progress
      await job.updateProgress(10);
      logger.info(`Sending email to ${data.to}`);

      // Validate email data
      this.validateEmailData(data);

      // Update progress
      await job.updateProgress(30);

      // TODO: Implement actual email sending logic
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate sending

      // Update progress
      await job.updateProgress(70);

      // Store email tracking data if sequenceId exists
      if (data.sequenceId) {
        await this.storeEmailTracking(data);
      }

      // Update progress
      await job.updateProgress(90);

      logger.info(`Email sent successfully to ${data.to}`);
    } catch (error) {
      logger.error(`Failed to send email to ${data.to}:`, error);
      throw error;
    }
  }

  private async handleScheduleEmail(
    job: Job<EmailJobData>,
    data: EmailJobData["data"]
  ): Promise<void> {
    try {
      // Update progress
      await job.updateProgress(10);
      logger.info(`Scheduling email to ${data.to}`);

      // Validate email data
      this.validateEmailData(data);

      // Update progress
      await job.updateProgress(50);

      // TODO: Implement actual email scheduling logic
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate scheduling

      logger.info(`Email scheduled successfully for ${data.to}`);
    } catch (error) {
      logger.error(`Failed to schedule email for ${data.to}:`, error);
      throw error;
    }
  }

  private validateEmailData(data: EmailJobData["data"]): void {
    if (!data.to) {
      throw new Error("Email recipient is required");
    }
    if (!data.subject) {
      throw new Error("Email subject is required");
    }
    if (!data.body) {
      throw new Error("Email body is required");
    }
  }

  private async storeEmailTracking(data: EmailJobData["data"]): Promise<void> {
    try {
      // TODO: Implement email tracking storage
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate storage
    } catch (error) {
      logger.error("Failed to store email tracking data:", error);
      // Don't throw here, just log the error as this is not critical
    }
  }
}
