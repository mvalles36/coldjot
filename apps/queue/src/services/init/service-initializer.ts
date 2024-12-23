// Services
import { QueueService } from "../queue/queue-service";
import { sequenceProcessor } from "../sequence/sequence-processor";
import { threadProcessor } from "../thread/thread-processor";
import { emailProcessor } from "../email/email-processor";

// Services
import { emailSchedulingService } from "../schedule/email-scheduling-service";
import { contactProcessingService } from "../sequence/contact-processing-service";

// Monitors
import { memoryMonitor } from "../memory/memory-monitor";
import { emailThreadMonitor } from "../thread/thread-monitor";

import { logger } from "../log/logger";
import Redis from "ioredis";
import { prisma } from "@mailjot/database";

export class ServiceInitializer {
  private static instance: ServiceInitializer;
  private redis: Redis;
  private queueService: QueueService;

  private constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    });

    this.queueService = QueueService.getInstance();

    // Set up Redis event handlers
    this.redis.on("error", (error) => {
      logger.error("❌ Redis connection error:", error);
    });

    this.redis.on("connect", () => {
      logger.info("✓ Redis connected successfully");
    });
  }

  public static getInstance(): ServiceInitializer {
    if (!ServiceInitializer.instance) {
      ServiceInitializer.instance = new ServiceInitializer();
    }
    return ServiceInitializer.instance;
  }

  public async initialize(): Promise<void> {
    logger.info("🚀 Initializing services...");

    try {
      // Initialize queue service and processors
      this.queueService.setProcessors(
        sequenceProcessor,
        emailProcessor,
        threadProcessor
      );
      logger.info("✓ Queue processors configured");

      // Start monitoring services
      await this.startMonitors();

      // Start processing services
      await this.startProcessors();

      logger.info("✓ All services initialized successfully");
    } catch (error) {
      logger.error("❌ Failed to initialize services:", error);
      throw error;
    }
  }

  private async startMonitors(): Promise<void> {
    try {
      // Start memory monitor
      memoryMonitor.startMonitoring(30000); // Check every 30 seconds
      logger.info("✓ Memory monitor started");

      // Start email thread monitor
      await emailThreadMonitor.start();
      logger.info("✓ Email thread monitor started");
    } catch (error) {
      logger.error("❌ Failed to start monitors:", error);
      throw error;
    }
  }

  private async startProcessors(): Promise<void> {
    try {
      // Start contact processing service
      await contactProcessingService.start();
      logger.info("✓ Contact processing service started");

      // Start email scheduling service
      await emailSchedulingService.start();
      logger.info("✓ Email scheduling service started");
    } catch (error) {
      logger.error("❌ Failed to start processors:", error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    logger.info("📥 Starting graceful shutdown...");

    try {
      // Stop processing services
      contactProcessingService.stop();
      logger.info("✓ Contact processing service stopped");

      emailSchedulingService.stop();
      logger.info("✓ Email scheduling service stopped");

      // Stop monitoring services
      await emailThreadMonitor.stop();
      logger.info("✓ Email thread monitor stopped");

      // Close connections
      await Promise.all([
        this.queueService.close(),
        this.redis.quit(),
        prisma.$disconnect(),
      ]);

      logger.info("✓ All services stopped gracefully");
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
      throw error;
    }
  }

  public getRedis(): Redis {
    return this.redis;
  }
}
