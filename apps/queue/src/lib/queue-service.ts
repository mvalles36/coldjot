import Bull from "bull";
import { env } from "../config";
import { logger } from "./logger";
import { ProcessingJob, EmailJob } from "../types/queue";

export class QueueService {
  private sequenceQueue: Bull.Queue;
  private emailQueue: Bull.Queue;
  private schedulingQueue: Bull.Queue;
  private monitoringQueue: Bull.Queue;
  private cleanupQueue: Bull.Queue;

  constructor() {
    const queueConfig = {
      redis: {
        host: env.REDIS_HOST,
        port: parseInt(env.REDIS_PORT),
        password: env.REDIS_PASSWORD,
      },
      prefix: "mailjot",
    };

    this.sequenceQueue = new Bull("sequence-processing", queueConfig);
    this.emailQueue = new Bull("email-sending", queueConfig);
    this.schedulingQueue = new Bull("scheduling", queueConfig);
    this.monitoringQueue = new Bull("monitoring", queueConfig);
    this.cleanupQueue = new Bull("cleanup", queueConfig);

    // Set up error handlers
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    const queues = [
      this.sequenceQueue,
      this.emailQueue,
      this.schedulingQueue,
      this.monitoringQueue,
      this.cleanupQueue,
    ];

    queues.forEach((queue) => {
      queue.on("error", (error) => {
        logger.error(`Queue ${queue.name} error:`, error);
      });

      queue.on("failed", (job, error) => {
        logger.error(`Job ${job.id} in queue ${queue.name} failed:`, error);
      });
    });
  }

  async addSequenceJob(job: ProcessingJob) {
    try {
      return await this.sequenceQueue.add(job.data, {
        priority: job.priority,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60 * 1000, // 1 minute
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    } catch (error) {
      logger.error("Error adding sequence job:", error);
      throw error;
    }
  }

  async addEmailJob(job: EmailJob) {
    try {
      return await this.emailQueue.add(job.data, {
        priority: job.priority,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 30 * 1000, // 30 seconds
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    } catch (error) {
      logger.error("Error adding email job:", error);
      throw error;
    }
  }

  async scheduleJob(job: Bull.Job, nextRun: Date) {
    try {
      const delay = nextRun.getTime() - Date.now();
      if (delay <= 0) {
        return job;
      }

      await job.update({
        ...job.data,
        scheduledFor: nextRun,
      });

      const newJob = await job.queue.add(job.data, {
        ...job.opts,
        delay,
        jobId: job.id,
      });

      await job.remove();

      return newJob;
    } catch (error) {
      logger.error("Error scheduling job:", error);
      throw error;
    }
  }

  async getJobStatus(jobId: string, queueName: string) {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const state = await job.getState();
      const progress = await job.progress();

      return {
        id: job.id,
        state,
        progress,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error) {
      logger.error("Error getting job status:", error);
      throw error;
    }
  }

  private getQueueByName(name: string): Bull.Queue | null {
    switch (name) {
      case "sequence-processing":
        return this.sequenceQueue;
      case "email-sending":
        return this.emailQueue;
      case "scheduling":
        return this.schedulingQueue;
      case "monitoring":
        return this.monitoringQueue;
      case "cleanup":
        return this.cleanupQueue;
      default:
        return null;
    }
  }

  async pauseQueue(name: string) {
    const queue = this.getQueueByName(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    await queue.pause();
  }

  async resumeQueue(name: string) {
    const queue = this.getQueueByName(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    await queue.resume();
  }

  async shutdown() {
    const queues = [
      this.sequenceQueue,
      this.emailQueue,
      this.schedulingQueue,
      this.monitoringQueue,
      this.cleanupQueue,
    ];

    await Promise.all(queues.map((queue) => queue.close()));
  }
}
