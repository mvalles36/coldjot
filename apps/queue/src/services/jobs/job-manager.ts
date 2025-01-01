import { Queue, Job } from "bullmq";
import { logger } from "@/lib/log";
import { QUEUE_NAMES } from "@/config";
import type { ProcessingJob, EmailJob } from "@mailjot/types";
import { ServiceManager } from "../service-manager";

export class JobManager {
  private serviceManager: ServiceManager;

  constructor(serviceManager: ServiceManager) {
    this.serviceManager = serviceManager;
  }

  /**
   * Add a sequence processing job to the queue
   */
  public async addSequenceJob(job: ProcessingJob): Promise<Job> {
    const queue = this.serviceManager.getQueue(QUEUE_NAMES.SEQUENCE);
    if (!queue) {
      throw new Error("Sequence queue not initialized");
    }

    logger.info(`Adding sequence job ${job.id} to queue`);
    return await queue.add(job.id, job.data, {
      jobId: job.id,
      priority: job.priority,
      removeOnComplete: true,
      removeOnFail: {
        count: 3, // Keep last 3 failed jobs
      },
    });
  }

  /**
   * Add an email job to the queue
   */
  public async addEmailJob(job: EmailJob): Promise<Job> {
    const queue = this.serviceManager.getQueue(QUEUE_NAMES.EMAIL);
    if (!queue) {
      throw new Error("Email queue not initialized");
    }
    logger.info(`Adding email job to queue`);
    return await queue.add(QUEUE_NAMES.EMAIL, job, {
      //   jobId: customJobId,
      removeOnComplete: {
        count: 5,
      },
      removeOnFail: {
        count: 5, // Keep last 3 failed jobs
      },
    });
  }

  /**
   * Get job counts for a specific queue
   */
  public async getJobCounts(queueName: string) {
    const queue = this.serviceManager.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not initialized`);
    }
    return await queue.getJobCounts();
  }

  /**
   * Get a specific job from a queue
   */
  public async getJob(
    queueName: string,
    jobId: string
  ): Promise<Job | undefined> {
    const queue = this.serviceManager.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not initialized`);
    }
    return await queue.getJob(jobId);
  }

  /**
   * Remove a job from a queue
   */
  public async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.serviceManager.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not initialized`);
    }
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Removed job ${jobId} from queue ${queueName}`);
    }
  }
}

// Export factory function
export const createJobManager = (
  serviceManager: ServiceManager
): JobManager => {
  return new JobManager(serviceManager);
};
