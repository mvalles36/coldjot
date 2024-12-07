import Bull from "bull";
import {
  queueConfig,
  QUEUE_NAMES,
  JOB_TYPES,
  JOB_PRIORITIES,
} from "./queue-config";
import type {
  ProcessingJob,
  EmailJob,
  MonitoringJob,
  CleanupJob,
  JobResult,
  QueueMetrics,
} from "./types";
import { logger } from "@/lib/logger";

class QueueService {
  private queues: Map<string, Bull.Queue>;
  private initialized: boolean = false;

  constructor() {
    this.queues = new Map();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize all queues
      for (const queueName of Object.values(QUEUE_NAMES)) {
        const queue = new Bull(queueName, queueConfig);
        this.queues.set(queueName, queue);

        // Set up error handling
        queue.on("error", (error) => {
          logger.error(`Queue ${queueName} error:`, error);
        });

        queue.on("failed", (job, error) => {
          logger.error(`Job ${job.id} in queue ${queueName} failed:`, error);
        });
      }

      this.initialized = true;
      logger.info("Queue service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize queue service:", error);
      throw error;
    }
  }

  private getQueue(name: string): Bull.Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue ${name} not found`);
    }
    return queue;
  }

  // Add jobs to queues
  async addProcessingJob(job: ProcessingJob): Promise<Bull.Job> {
    const queue = this.getQueue(QUEUE_NAMES.PROCESSING);
    return queue.add(JOB_TYPES.PROCESS_SEQUENCE, job, {
      priority: job.priority,
      jobId: job.id,
      attempts: 3,
    });
  }

  async addEmailJob(job: EmailJob): Promise<Bull.Job> {
    const queue = this.getQueue(QUEUE_NAMES.SENDING);
    return queue.add(JOB_TYPES.SEND_EMAIL, job, {
      priority: job.priority,
      jobId: job.id,
      attempts: 2,
    });
  }

  async addMonitoringJob(job: MonitoringJob): Promise<Bull.Job> {
    const queue = this.getQueue(QUEUE_NAMES.MONITORING);
    return queue.add(job.type, job, {
      priority: job.priority,
      jobId: job.id,
      repeat:
        job.type === "health_check" ? { every: 5 * 60 * 1000 } : undefined,
    });
  }

  async addCleanupJob(job: CleanupJob): Promise<Bull.Job> {
    const queue = this.getQueue(QUEUE_NAMES.CLEANUP);
    return queue.add(JOB_TYPES.CLEANUP_OLD_JOBS, job, {
      priority: JOB_PRIORITIES.LOW,
      jobId: job.id,
    });
  }

  // Process jobs
  async processJobs(
    queueName: string,
    processor: (job: Bull.Job) => Promise<JobResult>
  ) {
    const queue = this.getQueue(queueName);
    queue.process(async (job) => {
      try {
        const result = await processor(job);

        // Handle next job if specified
        if (result.nextJob) {
          const { type, data, options } = result.nextJob;
          const targetQueue = this.getQueueForJobType(type);
          await targetQueue.add(type, data, options);
        }

        return result;
      } catch (error) {
        logger.error(`Error processing job ${job.id}:`, error);
        throw error;
      }
    });
  }

  // Queue management
  async pauseQueue(name: string): Promise<void> {
    const queue = this.getQueue(name);
    await queue.pause();
  }

  async resumeQueue(name: string): Promise<void> {
    const queue = this.getQueue(name);
    await queue.resume();
  }

  async clearQueue(name: string): Promise<void> {
    const queue = this.getQueue(name);
    await queue.empty();
  }

  // Metrics
  async getQueueMetrics(name: string): Promise<QueueMetrics> {
    const queue = this.getQueue(name);
    const [
      jobCounts,
      failedCount,
      completedCount,
      delayedCount,
      activeCount,
      waitingCount,
      isPaused,
    ] = await Promise.all([
      queue.getJobCounts(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
      queue.getDelayedCount(),
      queue.getActiveCount(),
      queue.getWaitingCount(),
      queue.isPaused(),
    ]);

    const errorRate = failedCount / (failedCount + completedCount || 1);
    const processingTime = await this.calculateAverageProcessingTime(queue);

    return {
      name,
      size:
        jobCounts.waiting +
        jobCounts.active +
        jobCounts.delayed +
        jobCounts.failed +
        jobCounts.completed,
      processed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      active: activeCount,
      waiting: waitingCount,
      paused: isPaused,
      errorRate,
      processingTime,
    };
  }

  private async calculateAverageProcessingTime(
    queue: Bull.Queue
  ): Promise<number> {
    const completedJobs = await queue.getCompleted();
    if (completedJobs.length === 0) return 0;

    const processingTimes = completedJobs.map((job) => {
      const finishedOn = job.finishedOn || Date.now();
      const processedOn = job.processedOn || finishedOn;
      return finishedOn - processedOn;
    });

    return processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
  }

  private getQueueForJobType(type: string): Bull.Queue {
    switch (type) {
      case JOB_TYPES.PROCESS_SEQUENCE:
      case JOB_TYPES.PROCESS_STEP:
      case JOB_TYPES.PROCESS_CONTACT:
        return this.getQueue(QUEUE_NAMES.PROCESSING);
      case JOB_TYPES.SEND_EMAIL:
      case JOB_TYPES.RETRY_EMAIL:
      case JOB_TYPES.CHECK_BOUNCE:
        return this.getQueue(QUEUE_NAMES.SENDING);
      case JOB_TYPES.HEALTH_CHECK:
      case JOB_TYPES.COLLECT_METRICS:
      case JOB_TYPES.CHECK_RATE_LIMITS:
        return this.getQueue(QUEUE_NAMES.MONITORING);
      case JOB_TYPES.CLEANUP_OLD_JOBS:
      case JOB_TYPES.CLEANUP_FAILED_JOBS:
        return this.getQueue(QUEUE_NAMES.CLEANUP);
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }

  // Cleanup
  async shutdown(): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        logger.info(`Queue ${name} closed successfully`);
      } catch (error) {
        logger.error(`Error closing queue ${name}:`, error);
      }
    }
    this.initialized = false;
  }
}

// Export singleton instance
export const queueService = new QueueService();
