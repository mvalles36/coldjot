import Bull from "bull";
import { logger } from "@/services/log/logger";
import {
  ProcessingJob,
  EmailJob,
  JobCounts,
  ThreadCheckData,
} from "@mailjot/types";
import { REDIS_KEYS, QUEUE_CONFIG } from "@/config/constants";

import type { SequenceProcessor } from "@/services/sequence/sequence-processor";
import type { EmailProcessor } from "@/services/email/email-processor";
import type { EmailThreadProcessor } from "@/services/thread/thread-processor";

export class QueueService {
  private static instance: QueueService | null = null;

  // Queues
  private sequenceQueue: Bull.Queue;
  private emailQueue: Bull.Queue;
  private threadQueue: Bull.Queue;

  // Processors
  private sequenceProcessor?: SequenceProcessor;
  private emailProcessor?: EmailProcessor;
  private threadProcessor?: EmailThreadProcessor;

  private constructor() {
    logger.info("🔄 Initializing queue service...");

    const redisConfig = {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      prefix: "mailjot:queues", // Global prefix for all queues
      defaultJobOptions: QUEUE_CONFIG.DEFAULT_JOB_OPTIONS,
    };

    this.sequenceQueue = new Bull(REDIS_KEYS.QUEUES.SEQUENCE, {
      ...redisConfig,
      defaultJobOptions: {
        ...redisConfig.defaultJobOptions,
        attempts: QUEUE_CONFIG.RETRY_OPTIONS.SEQUENCE.attempts,
        backoff: QUEUE_CONFIG.RETRY_OPTIONS.SEQUENCE.backoff,
      },
    });

    this.emailQueue = new Bull(REDIS_KEYS.QUEUES.EMAIL, {
      ...redisConfig,
      defaultJobOptions: {
        ...redisConfig.defaultJobOptions,
        attempts: QUEUE_CONFIG.RETRY_OPTIONS.EMAIL.attempts,
        backoff: QUEUE_CONFIG.RETRY_OPTIONS.EMAIL.backoff,
      },
    });

    this.threadQueue = new Bull(REDIS_KEYS.QUEUES.THREAD, {
      ...redisConfig,
      defaultJobOptions: {
        ...redisConfig.defaultJobOptions,
        attempts: QUEUE_CONFIG.RETRY_OPTIONS.THREAD.attempts,
        backoff: QUEUE_CONFIG.RETRY_OPTIONS.THREAD.backoff,
      },
    });

    // Add periodic cleanup
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Run cleanup every hour

    // Set up queue event listeners
    this.setupEventListeners();
    logger.info("✓ Queue service initialized");
  }

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  public setProcessors(
    sequenceProcessor: SequenceProcessor,
    emailProcessor: EmailProcessor,
    threadProcessor: EmailThreadProcessor
  ) {
    logger.info("🔄 Setting up queue processors...");
    this.sequenceProcessor = sequenceProcessor;
    this.emailProcessor = emailProcessor;
    this.threadProcessor = threadProcessor;
    this.setupProcessors();
    logger.info("✓ Queue processors configured");
  }

  private setupEventListeners() {
    const setupQueueListeners = (queue: Bull.Queue, name: string) => {
      queue.on("completed", (job) => {
        logger.info(`✅ ${name} job ${job.id} completed successfully`);
      });

      queue.on("failed", (job, error) => {
        logger.error(`❌ ${name} job ${job.id} failed:`, error);
      });

      queue.on("stalled", (job) => {
        logger.warn(`⚠️ ${name} job ${job.id} is stalled`);
      });

      queue.on("waiting", (jobId) => {
        logger.info(`📥 ${name} job ${jobId} waiting to be processed`);
      });

      queue.on("active", (job) => {
        logger.info(`⚡ ${name} job ${job.id} has started processing`);
      });

      queue.on("progress", (job, progress) => {
        logger.info(`📊 ${name} job ${job.id} progress:`, progress);
      });
    };

    setupQueueListeners(this.sequenceQueue, "Sequence");
    setupQueueListeners(this.emailQueue, "Email");
    setupQueueListeners(this.threadQueue, "Thread");
  }

  private setupProcessors() {
    if (
      !this.sequenceProcessor ||
      !this.emailProcessor ||
      !this.threadProcessor
    ) {
      throw new Error("Processors not initialized");
    }

    // Process sequence jobs
    this.sequenceQueue.process(async (job) => {
      const processingJob: ProcessingJob = {
        type: "sequence",
        id: job.id.toString(),
        priority: job.opts.priority || 1,
        data: job.data,
      };
      return this.sequenceProcessor!.processSequenceJob(processingJob);
    });

    // Process email jobs
    this.emailQueue.process(async (job) => {
      const emailJob: EmailJob = {
        id: job.id.toString(),
        type: job.data.type || "send",
        priority: job.opts.priority || 1,
        data: job.data,
      };
      return this.emailProcessor!.processEmail(emailJob);
    });

    // Process thread jobs
    this.threadQueue.process(async (job) => {
      return this.threadProcessor!.processThread(job.data as ThreadCheckData);
    });
  }

  // Add jobs to queues
  async addSequenceJob(job: ProcessingJob): Promise<Bull.Job> {
    logger.info(`📥 Adding sequence job to queue`, job);
    return this.sequenceQueue.add(job.data, {
      priority: job.priority,
      attempts: QUEUE_CONFIG.RETRY_OPTIONS.SEQUENCE.attempts,
      backoff: QUEUE_CONFIG.RETRY_OPTIONS.SEQUENCE.backoff,
    });
  }

  async addEmailJob(job: EmailJob): Promise<Bull.Job> {
    logger.info(`📥 Adding email job to queue`, job);
    return this.emailQueue.add(job.data, {
      priority: job.priority,
      attempts: QUEUE_CONFIG.RETRY_OPTIONS.EMAIL.attempts,
      backoff: QUEUE_CONFIG.RETRY_OPTIONS.EMAIL.backoff,
    });
  }

  async addThreadJob(
    data: ThreadCheckData,
    priority: number = 1,
    delay?: number
  ): Promise<Bull.Job> {
    logger.info(`📥 Adding thread job to queue`, data);
    return this.threadQueue.add(data, {
      priority,
      delay,
      attempts: QUEUE_CONFIG.RETRY_OPTIONS.THREAD.attempts,
      backoff: QUEUE_CONFIG.RETRY_OPTIONS.THREAD.backoff,
    });
  }

  // Get job counts
  async getJobCounts(): Promise<JobCounts> {
    const [sequenceCounts, emailCounts, threadCounts] = await Promise.all([
      this.sequenceQueue.getJobCounts(),
      this.emailQueue.getJobCounts(),
      this.threadQueue.getJobCounts(),
    ]);

    return {
      waiting:
        sequenceCounts.waiting + emailCounts.waiting + threadCounts.waiting,
      active: sequenceCounts.active + emailCounts.active + threadCounts.active,
      completed:
        sequenceCounts.completed +
        emailCounts.completed +
        threadCounts.completed,
      failed: sequenceCounts.failed + emailCounts.failed + threadCounts.failed,
      delayed:
        sequenceCounts.delayed + emailCounts.delayed + threadCounts.delayed,
    };
  }

  // Get detailed queue status
  async getDetailedQueueStatus(): Promise<{
    sequence: Bull.JobCounts;
    email: Bull.JobCounts;
    thread: Bull.JobCounts;
  }> {
    const [sequenceCounts, emailCounts, threadCounts] = await Promise.all([
      this.sequenceQueue.getJobCounts(),
      this.emailQueue.getJobCounts(),
      this.threadQueue.getJobCounts(),
    ]);

    return {
      sequence: sequenceCounts,
      email: emailCounts,
      thread: threadCounts,
    };
  }

  // Clean up jobs
  async cleanup(age: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      logger.info("🧹 Starting queue cleanup...");

      const queues = [this.sequenceQueue, this.emailQueue, this.threadQueue];
      const states = [
        "completed",
        "failed",
        "wait",
        "delayed",
        "active",
      ] as const;

      await Promise.all(
        queues.flatMap((queue) =>
          states.map((state) => queue.clean(age, state))
        )
      );

      // Get all jobs to clean up events
      const allJobs = await Promise.all(
        queues.map((queue) => queue.getJobs(["completed", "failed"]))
      );

      // Keep only the most recent 1000 jobs per queue
      const jobsToRemove = allJobs.flatMap((jobs) => jobs.slice(1000));

      // Remove excess jobs
      await Promise.all(jobsToRemove.map((job) => job.remove()));

      logger.info("✓ Queue cleanup completed");
    } catch (error) {
      logger.error("❌ Error during queue cleanup:", error);
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    logger.info("🛑 Closing queue connections...");
    try {
      await Promise.all([
        this.sequenceQueue.close(),
        this.emailQueue.close(),
        this.threadQueue.close(),
      ]);
      logger.info("✓ Queue connections closed");
    } catch (error) {
      logger.error("❌ Error closing queue connections:", error);
      throw error;
    }
  }
}
