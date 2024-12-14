import express from "express";
import cors from "cors";
import { env } from "./config";
import { prisma } from "@mailjot/database";
import { QueueService } from "@/services/queue/queue-service";
import { SchedulingService } from "@/services/schedule/scheduling-service";
import { MonitoringService } from "@/services/monitor/monitoring-service";
import { sequenceProcessor } from "@/services/sequence/sequence-processor";
import { emailProcessor } from "@/services/email/email-processor";
import { logger } from "@/services/log/logger";
import pinoHttp from "pino-http";
import Redis from "ioredis";
import routes from "./routes";
import { contactProcessingService } from "@/services/sequence/contact-processing-service";
import { emailSchedulingService } from "@/services/schedule/email-scheduling-service";
import { memoryMonitor } from "@/services/monitor/memory-monitor";

const app = express();
const port = 3001;

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

redis.on("error", (error) => {
  logger.error("❌ Redis connection error:", error);
});

redis.on("connect", () => {
  logger.info("✓ Redis connected successfully");
});

// Initialize services in the correct order
logger.info("🚀 Initializing services...");

// Initialize queue service first
const queueService = QueueService.getInstance();
logger.info("✓ Queue service initialized");

// Set up processors
queueService.setProcessors(sequenceProcessor, emailProcessor);
logger.info("✓ Queue processors configured");

// Initialize other services
const schedulingService = new SchedulingService();
const monitoringService = new MonitoringService(queueService);

// Start contact processing service
contactProcessingService.start().catch((error) => {
  logger.error("❌ Failed to start contact processing service:", error);
});
logger.info("✓ Contact processing service started");

// Start email scheduling service
emailSchedulingService.start().catch((error) => {
  logger.error("❌ Failed to start email scheduling service:", error);
});
logger.info("✓ Email scheduling service started");

logger.info("✓ All services initialized");

// Add after initializing services
memoryMonitor.startMonitoring(30000); // Check every 30 seconds

// Middleware
app.use(cors());
app.use(express.json());

// Add request logging
const httpLogger = pinoHttp({
  logger,
  customLogLevel: function (req, res, error) {
    if (error) return "error";
    if (res.statusCode >= 400 && res.statusCode < 500) return "warn";
    if (res.statusCode >= 500) return "error";
    return "info";
  },
  customSuccessMessage: function (req, res) {
    return `request completed with status ${res.statusCode}`;
  },
  customErrorMessage: function (req, res, error) {
    return `request failed with status ${res.statusCode}: ${error.message}`;
  },
});

// Mount all routes
app.use("/api", routes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(err, "Unhandled error");
    res.status(500).json({ error: "Internal Server Error" });
  }
);

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  logger.info("📥 Received SIGTERM signal. Starting graceful shutdown...");

  // Stop the contact processing service
  contactProcessingService.stop();
  logger.info("✓ Contact processing service stopped");

  // Stop the email scheduling service
  emailSchedulingService.stop();
  logger.info("✓ Email scheduling service stopped");

  // Close other services and connections
  await Promise.all([queueService.close(), redis.quit(), prisma.$disconnect()]);

  logger.info("✓ All services stopped gracefully");
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("📥 Received SIGINT signal. Starting graceful shutdown...");

  // Stop the contact processing service
  contactProcessingService.stop();
  logger.info("✓ Contact processing service stopped");

  // Stop the email scheduling service
  emailSchedulingService.stop();
  logger.info("✓ Email scheduling service stopped");

  // Close other services and connections
  await Promise.all([queueService.close(), redis.quit(), prisma.$disconnect()]);

  logger.info("✓ All services stopped gracefully");
  process.exit(0);
});

// Start the server
const server = app.listen(port, () => {
  logger.info(`Queue service listening on port ${port}`);
});
