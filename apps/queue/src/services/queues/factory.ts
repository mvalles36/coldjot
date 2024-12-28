import { Queue, Worker, ConnectionOptions } from "bullmq";
import { logger } from "@/lib/log";
import {
  QUEUE_NAMES,
  DEFAULT_QUEUE_OPTIONS,
  QUEUE_OPTIONS,
  PROCESSOR_CONCURRENCY,
  type QueueName,
} from "@/config/queue/queue";

export class QueueFactory {
  private static instance: QueueFactory;
  private redisClient: ConnectionOptions;

  private constructor(redisClient: ConnectionOptions) {
    this.redisClient = redisClient;
  }

  public static getInstance(redisClient: ConnectionOptions): QueueFactory {
    if (!QueueFactory.instance) {
      QueueFactory.instance = new QueueFactory(redisClient);
    }
    return QueueFactory.instance;
  }

  public createQueue(name: QueueName): Queue {
    try {
      // Get queue-specific options or use defaults
      const queueConfig = {
        connection: this.redisClient,
        ...(QUEUE_OPTIONS[name] || DEFAULT_QUEUE_OPTIONS),
      };

      const queue = new Queue(QUEUE_NAMES[name], queueConfig);
      logger.info(`📬 Queue created: ${name}`);

      return queue;
    } catch (error) {
      logger.error(`❌ Error creating queue ${name}:`, error);
      throw error;
    }
  }

  public createWorker(
    name: QueueName,
    processor: (job: any) => Promise<any>
  ): Worker {
    try {
      const worker = new Worker(QUEUE_NAMES[name], processor, {
        connection: this.redisClient,
        concurrency: PROCESSOR_CONCURRENCY[name] || 1,
        ...(QUEUE_OPTIONS[name] || DEFAULT_QUEUE_OPTIONS),
      });

      // Set up worker event handlers
      this.setupWorkerEvents(worker, name);

      logger.info(`👷 Worker created for queue: ${name}`);
      return worker;
    } catch (error) {
      logger.error(`❌ Error creating worker for queue ${name}:`, error);
      throw error;
    }
  }

  private setupWorkerEvents(worker: Worker, name: string): void {
    worker
      .on("completed", (job) => {
        if (job) {
          logger.info(
            `✅ Job ${job.id} completed in queue ${name} after ${
              job.attemptsMade
            } attempts`
          );
        }
      })
      .on("failed", (job, error) => {
        if (job) {
          logger.error(
            `❌ Job ${job.id} failed in queue ${name} after ${
              job.attemptsMade
            } attempts:`,
            error
          );
        }
      })
      .on("error", (error) => {
        logger.error(`❌ Worker error in queue ${name}:`, error);
      })
      .on("active", (job) => {
        if (job) {
          logger.info(`⚡ Processing job ${job.id} in queue ${name}`);
        }
      })
      .on("stalled", (jobId) => {
        logger.warn(`⚠️ Job ${jobId} stalled in queue ${name}`);
      });
  }
}
