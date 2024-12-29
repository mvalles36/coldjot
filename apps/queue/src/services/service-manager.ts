import { Queue } from "bullmq";
import { logger } from "@/lib/log";
import { RedisConnection } from "./shared/redis/connection";
import {
  QUEUE_NAMES,
  QUEUE_OPTIONS,
  DEFAULT_QUEUE_OPTIONS,
} from "@/config/queue/queue";

// Core services
import { MemoryMonitor } from "./core/memory/monitor";
import { RateLimitService } from "./core/rate-limit/service";

// Import processors directly
import { SequenceProcessor } from "./jobs/sequence/processor";
import { EmailProcessor } from "./jobs/email/processor";
import { ContactProcessor } from "./jobs/contact/processor";
import { ScheduleProcessor } from "./jobs/schedule/processor";
import { ThreadProcessor } from "./jobs/thread-watch/processor";

type Processor =
  | EmailProcessor
  | SequenceProcessor
  | ThreadProcessor
  | ContactProcessor
  | ScheduleProcessor;

export class ServiceManager {
  private static instance: ServiceManager;
  private redisConnection: RedisConnection;
  private memoryMonitor: MemoryMonitor | null = null;
  private rateLimitService: RateLimitService | null = null;
  private queues: Map<string, Queue>;
  private processors: Map<string, Processor>;

  private constructor() {
    this.redisConnection = RedisConnection.getInstance();
    this.queues = new Map();
    this.processors = new Map();
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      logger.info("🚀 Initializing Service Manager...");

      // Initialize core services
      await this.initializeCoreServices();

      // Initialize queues
      await this.initializeQueues();

      // Initialize processors
      await this.initializeProcessors();

      logger.info("✨ Service Manager initialized successfully");
    } catch (error) {
      logger.error("❌ Error initializing Service Manager:", error);
      throw error;
    }
  }

  private async initializeCoreServices(): Promise<void> {
    try {
      logger.info("🔧 Initializing core services...");

      // Initialize memory monitor
      this.memoryMonitor = MemoryMonitor.getInstance();
      await this.memoryMonitor.startMonitoring();

      // Initialize rate limit service
      this.rateLimitService = RateLimitService.getInstance();
      logger.info("⚡ Rate limit service initialized");
    } catch (error) {
      logger.error("❌ Error initializing core services:", error);
      throw error;
    }
  }

  private async initializeQueues(): Promise<void> {
    try {
      logger.info("📦 Initializing queues...");

      // Get all queue names from config
      const queueNames = Object.values(QUEUE_NAMES);

      for (const name of queueNames) {
        // Get queue-specific options or use defaults
        const queueConfig =
          QUEUE_OPTIONS[name as keyof typeof QUEUE_NAMES] ||
          DEFAULT_QUEUE_OPTIONS;

        // Create queue with connection and config
        const queue = new Queue(name, {
          connection: this.redisConnection.getClient(),
          ...queueConfig,
        });

        this.queues.set(name, queue);
        logger.info(`📬 Queue initialized: ${name}`);
      }

      logger.info(`✅ Initialized ${queueNames.length} queues`);
    } catch (error) {
      logger.error("❌ Error initializing queues:", error);
      throw error;
    }
  }

  private async initializeProcessors(): Promise<void> {
    try {
      logger.info("⚙️ Initializing processors...");

      const processorMap = {
        [QUEUE_NAMES.SEQUENCE]: (queue: Queue) => new SequenceProcessor(queue),
        [QUEUE_NAMES.EMAIL]: (queue: Queue) => new EmailProcessor(queue),
        [QUEUE_NAMES.THREAD_WATCHER]: (queue: Queue) =>
          new ThreadProcessor(queue),
        [QUEUE_NAMES.CONTACT]: (queue: Queue) => new ContactProcessor(queue),
        [QUEUE_NAMES.EMAIL_SCHEDULE]: (queue: Queue) => new ScheduleProcessor(queue),
      };

      for (const [name, createProcessor] of Object.entries(processorMap)) {
        const queue = this.queues.get(name);
        if (!queue) {
          logger.warn(`⚠️ No queue found for processor: ${name}`);
          continue;
        }

        try {
          const processor = createProcessor(queue);
          this.processors.set(name, processor);
          logger.info(`⚙️ Processor initialized: ${name}`);
        } catch (error) {
          logger.error(error, `❌ Failed to initialize processor: ${name}`);
        }
      }

      const successCount = this.processors.size;
      logger.info(
        `✅ Initialized ${successCount}/${Object.keys(processorMap).length} processors successfully`
      );
    } catch (error) {
      logger.error("❌ Error initializing processors:", error);
      throw error;
    }
  }

  public getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  public getProcessor(name: string): Processor | undefined {
    return this.processors.get(name);
  }

  public async shutdown(): Promise<void> {
    try {
      logger.info("🛑 Shutting down Service Manager...");

      // Stop memory monitor
      if (this.memoryMonitor) {
        await this.memoryMonitor.stopMonitoring();
        logger.info("📊 Memory monitor stopped");
      }

      // Close all queues
      for (const [name, queue] of this.queues.entries()) {
        await queue.close();
        logger.info(`📬 Queue closed: ${name}`);
      }

      // Close Redis connection
      await this.redisConnection.close();
      logger.info("🔌 Redis connection closed");

      logger.info("✨ Service Manager shutdown complete");
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
      throw error;
    }
  }
}

// Export factory function
export const createServiceManager = (): ServiceManager => {
  return ServiceManager.getInstance();
};
