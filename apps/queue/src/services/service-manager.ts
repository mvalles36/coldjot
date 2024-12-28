import { Queue } from "bullmq";
import { logger } from "@/lib/log";
import { RedisConnection } from "./shared/redis/connection";
import {
  QUEUE_NAMES,
  QUEUE_OPTIONS,
  DEFAULT_QUEUE_OPTIONS,
  QUEUE_PATHS,
} from "@/config/queue/queue";

// Core services
import { MemoryMonitor } from "./core/memory/monitor";
import { RateLimitService } from "./core/rate-limit/service";

// Import types for processors
import type { EmailProcessor } from "./jobs/email/processor";
import type { SequenceProcessor } from "./jobs/sequence/processor";
import type { ThreadProcessor } from "./jobs/thread/processor";
import type { ContactProcessor } from "./jobs/contact/processor";
import type { ScheduleProcessor } from "./jobs/schedule/processor";

type Processor =
  | EmailProcessor
  | SequenceProcessor
  | ThreadProcessor
  | ContactProcessor
  | ScheduleProcessor;

type ProcessorModule = {
  createEmailProcessor?: (queue: Queue) => EmailProcessor;
  createSequenceProcessor?: (queue: Queue) => SequenceProcessor;
  createThreadProcessor?: (queue: Queue) => ThreadProcessor;
  createContactProcessor?: (queue: Queue) => ContactProcessor;
  createScheduleProcessor?: (queue: Queue) => ScheduleProcessor;
};

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
      logger.info("���� Initializing core services...");

      // Initialize memory monitor
      this.memoryMonitor = MemoryMonitor.getInstance();
      await this.memoryMonitor.startMonitoring();

      // Initialize rate limit service
      this.rateLimitService = RateLimitService.getInstance();
      logger.info("��� Rate limit service initialized");
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

      // Get all queue names and prepare imports
      const queueKeys = Object.keys(QUEUE_NAMES) as Array<
        keyof typeof QUEUE_NAMES
      >;
      const processorImports = queueKeys.map((queueKey) => {
        const queue = this.queues.get(QUEUE_NAMES[queueKey]);
        if (!queue) {
          throw new Error(`Queue not found: ${QUEUE_NAMES[queueKey]}`);
        }

        // Get processor path from config
        const processorFolder = QUEUE_PATHS[queueKey];
        const processorPath = `./jobs/${processorFolder}/processor`;
        logger.info(`🔍 Loading processor from: ${processorPath}`);

        return {
          queueKey,
          queue,
          importPromise: import(processorPath) as Promise<ProcessorModule>,
        };
      });

      // Import all processor modules in parallel
      const results = await Promise.all(
        processorImports.map(async ({ queueKey, queue, importPromise }) => {
          try {
            const module = await importPromise;
            const processorFolder = QUEUE_PATHS[queueKey];
            const processorKey = `create${
              processorFolder.charAt(0).toUpperCase() + processorFolder.slice(1)
            }Processor`;

            const createProcessor =
              module[processorKey as keyof ProcessorModule];
            if (!createProcessor) {
              logger.warn(
                `⚠️ No processor found for queue ${QUEUE_NAMES[queueKey]} (${processorKey})`
              );
              return null;
            }

            // Initialize the processor
            const processor = createProcessor(queue);
            return {
              key: processorFolder,
              processor,
            };
          } catch (error) {
            logger.error(
              `❌ Failed to initialize processor for ${QUEUE_NAMES[queueKey]}:`,
              error
            );
            return null;
          }
        })
      );

      // Store successful processor initializations
      results.forEach((result) => {
        if (result) {
          this.processors.set(result.key, result.processor);
          logger.info(`⚙️ Processor initialized: ${result.key}`);
        }
      });

      const successCount = results.filter(Boolean).length;
      logger.info(
        `✅ Initialized ${successCount}/${queueKeys.length} processors successfully`
      );

      if (successCount < queueKeys.length) {
        logger.warn(
          `⚠️ Some processors failed to initialize (${
            queueKeys.length - successCount
          } failed)`
        );
      }
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

      // Close all processors
      for (const [name, processor] of this.processors.entries()) {
        // TODO: check if this is required
        // await processor.close();
        logger.info(`⚙️ Processor closed: ${name}`);
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
