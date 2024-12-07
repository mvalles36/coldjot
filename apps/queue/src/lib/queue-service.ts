import Bull from "bull";
import { env } from "../config";
import { logger } from "./logger";

const queueConfig = {
  redis: {
    host: env.REDIS_HOST || "localhost",
    port: parseInt(env.REDIS_PORT || "6379"),
    password: env.REDIS_PASSWORD,
  },
  prefix: "mailjot",
};

// Queue names
export const QUEUE_NAMES = {
  SEQUENCE: "sequence-processing",
  EMAIL: "email-sending",
} as const;

class QueueService {
  private sequenceQueue: Bull.Queue;
  private emailQueue: Bull.Queue;
  private initialized = false;

  constructor() {
    this.sequenceQueue = new Bull(QUEUE_NAMES.SEQUENCE, queueConfig);
    this.emailQueue = new Bull(QUEUE_NAMES.EMAIL, queueConfig);
  }

  async initialize() {
    if (this.initialized) return;

    // Set up error handling
    [this.sequenceQueue, this.emailQueue].forEach((queue) => {
      queue.on("error", (error) => {
        logger.error(`Queue error:`, error);
      });

      queue.on("failed", (job, error) => {
        logger.error(`Job ${job.id} failed:`, error);
      });
    });

    this.initialized = true;
    logger.info("Queue service initialized");
  }

  async addSequenceJob(data: {
    sequenceId: string;
    userId: string;
    priority?: number;
  }) {
    return this.sequenceQueue.add(data, {
      priority: data.priority,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
  }

  async addEmailJob(data: {
    sequenceId: string;
    stepId: string;
    contactId: string;
    userId: string;
    priority?: number;
  }) {
    return this.emailQueue.add(data, {
      priority: data.priority,
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
  }

  async getJobStatus(jobId: string, type: string) {
    const queue = type === "email" ? this.emailQueue : this.sequenceQueue;
    const job = await queue.getJob(jobId);

    if (!job) {
      return { status: "not_found" };
    }

    const state = await job.getState();
    const progress = job.progress();
    const failCount = job.attemptsMade;

    return {
      id: job.id,
      status: state,
      progress,
      failCount,
      data: job.data,
    };
  }

  async shutdown() {
    await Promise.all([this.sequenceQueue.close(), this.emailQueue.close()]);
    logger.info("Queue service shut down");
  }
}

// Export singleton instance
export const queueService = new QueueService();
