import Bull from "bull";
import { logger } from "@/lib/log/logger";
import { ProcessingJob, EmailJob, JobCounts } from "@/types/queue";
import type { SequenceProcessor } from "@/lib/sequence/sequence-processor";
import type { EmailProcessor } from "@/lib/email/email-processor";
import { randomUUID } from "crypto";

export class QueueService {
  private sequenceQueue: Bull.Queue;
  private emailQueue: Bull.Queue;
  private static instance: QueueService | null = null;
  private sequenceProcessor?: SequenceProcessor;
  private emailProcessor?: EmailProcessor;

  private constructor() {
    logger.info("🔄 Initializing queue service...");

    this.sequenceQueue = new Bull("sequence-processing", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      prefix: "mailjot",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

    this.emailQueue = new Bull("email-sending", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      prefix: "mailjot",
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

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
    emailProcessor: EmailProcessor
  ) {
    logger.info("🔄 Setting up queue processors...");
    this.sequenceProcessor = sequenceProcessor;
    this.emailProcessor = emailProcessor;
    this.setupProcessors();
    logger.info("✓ Queue processors configured");
  }

  private setupEventListeners() {
    // Add event listeners for job lifecycle
    this.sequenceQueue.on("completed", (job) => {
      logger.info(`✅ Sequence job ${job.id} completed successfully`);
    });

    this.sequenceQueue.on("failed", (job, error) => {
      logger.error(`❌ Sequence job ${job.id} failed:`, error);
    });

    this.sequenceQueue.on("stalled", (job) => {
      logger.warn(`⚠️ Sequence job ${job.id} is stalled`);
    });

    this.emailQueue.on("completed", (job) => {
      logger.info(`✅ Email job ${job.id} completed successfully`);
    });

    this.emailQueue.on("failed", (job, error) => {
      logger.error(`❌ Email job ${job.id} failed:`, error);
    });

    this.emailQueue.on("stalled", (job) => {
      logger.warn(`⚠️ Email job ${job.id} is stalled`);
    });

    // Add more detailed event listeners for email queue
    this.emailQueue.on("waiting", (jobId) => {
      logger.info(`📥 Email job ${jobId} waiting to be processed`);
    });

    this.emailQueue.on("active", (job) => {
      logger.info(`⚡ Email job ${job.id} has started processing`);
    });

    this.emailQueue.on("progress", (job, progress) => {
      logger.info(`📊 Email job ${job.id} progress:`, progress);
    });
  }

  private setupProcessors() {
    if (!this.sequenceProcessor || !this.emailProcessor) {
      throw new Error("Processors not initialized");
    }

    logger.info("🔄 Setting up sequence queue processor...");
    // Process sequence jobs
    this.sequenceQueue.process(async (job) => {
      const processingJob: ProcessingJob = {
        type: "sequence",
        id: job.id.toString(),
        priority: job.opts.priority || 1,
        data: {
          sequenceId: job.data.sequenceId,
          userId: job.data.userId,
          scheduleType: job.data.scheduleType || "custom",
          businessHours: job.data.businessHours,
          testMode: job.data.testMode || false,
        },
      };
      return this.sequenceProcessor!.processSequenceJob(processingJob);
    });

    logger.info("🔄 Setting up email queue processor...");
    // Process email jobs
    this.emailQueue.process(async (job) => {
      const { data } = job;
      logger.info(`📨 Processing email job from queue: ${job.id}`, {
        type: data.type,
        sequenceId: data.sequenceId,
        contactId: data.contactId,
      });

      try {
        const emailJob: EmailJob = {
          id: job.id.toString(),
          type: data.type || "send",
          priority: job.opts.priority || 1,
          data: {
            sequenceId: data.sequenceId,
            contactId: data.contactId,
            stepId: data.stepId,
            userId: data.userId,
            messageId: data.messageId,
            emailOptions: data.emailOptions,
            tracking: data.tracking,
            account: data.account,
          },
        };

        logger.info(`📧 Processing email job: ${emailJob.id}`, {
          type: emailJob.type,
          to: emailJob.data.emailOptions.to,
          subject: emailJob.data.emailOptions.subject,
        });

        switch (emailJob.type) {
          case "send":
            return this.emailProcessor!.processEmail(emailJob);
          case "bounce_check":
            return this.emailProcessor!.checkBounce(emailJob);
          default:
            throw new Error(`Unknown email job type: ${emailJob.type}`);
        }
      } catch (error) {
        logger.error(`❌ Error processing email job: ${job.id}`, error);
        throw error;
      }
    });
    logger.info("✓ Queue processors setup complete");
  }

  // Add a sequence processing job
  async addSequenceJob(job: ProcessingJob): Promise<Bull.Job> {
    logger.info(`📥 Adding sequence job to queue`, {
      sequenceId: job.data.sequenceId,
      userId: job.data.userId,
    });

    const queuedJob = await this.sequenceQueue.add(
      {
        sequenceId: job.data.sequenceId,
        userId: job.data.userId,
        scheduleType: job.data.scheduleType,
        businessHours: job.data.businessHours,
        testMode: job.data.testMode,
      },
      {
        priority: job.priority,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      }
    );

    logger.info(`✓ Sequence job added to queue: ${queuedJob.id}`);
    return queuedJob;
  }

  // Add an email sending job
  async addEmailJob(job: EmailJob): Promise<Bull.Job> {
    logger.info(job, `📥 Adding email job to queue`);

    const queuedJob = await this.emailQueue.add(
      {
        type: job.type,
        sequenceId: job.data.sequenceId,
        contactId: job.data.contactId,
        stepId: job.data.stepId,
        userId: job.data.userId,
        messageId: job.data.messageId,
        emailOptions: job.data.emailOptions,
        tracking: job.data.tracking,
        account: job.data.account,
      },
      {
        priority: job.priority,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      }
    );

    logger.info(`✓ Email job added to queue: ${queuedJob.id}`, {
      type: job.type,
      to: job.data.emailOptions.to,
    });
    return queuedJob;
  }

  // Get job counts for monitoring
  async getJobCounts(): Promise<JobCounts> {
    const [sequenceCounts, emailCounts] = await Promise.all([
      this.sequenceQueue.getJobCounts(),
      this.emailQueue.getJobCounts(),
    ]);

    return {
      waiting: sequenceCounts.waiting + emailCounts.waiting,
      active: sequenceCounts.active + emailCounts.active,
      completed: sequenceCounts.completed + emailCounts.completed,
      failed: sequenceCounts.failed + emailCounts.failed,
      delayed: sequenceCounts.delayed + emailCounts.delayed,
    };
  }

  // Get detailed queue status
  async getDetailedQueueStatus(): Promise<{
    sequence: Bull.JobCounts;
    email: Bull.JobCounts;
  }> {
    const [sequenceCounts, emailCounts] = await Promise.all([
      this.sequenceQueue.getJobCounts() as Promise<Bull.JobCounts>,
      this.emailQueue.getJobCounts() as Promise<Bull.JobCounts>,
    ]);

    return {
      sequence: sequenceCounts,
      email: emailCounts,
    };
  }

  // Clean up completed and failed jobs
  async cleanup(age: number = 24 * 60 * 60 * 1000): Promise<void> {
    await Promise.all([
      this.sequenceQueue.clean(age, "completed"),
      this.sequenceQueue.clean(age, "failed"),
      this.emailQueue.clean(age, "completed"),
      this.emailQueue.clean(age, "failed"),
    ]);
  }
}
