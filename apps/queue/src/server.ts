import express from "express";
import cors from "cors";
import { env } from "./config";
import { prisma } from "@mailjot/database";
import { QueueService } from "./lib/queue/queue-service";
import { SchedulingService } from "./lib/schedule/scheduling-service";
import { MonitoringService } from "./lib/monitor/monitoring-service";
import { sequenceProcessor } from "./lib/sequence/sequence-processor";
import { emailProcessor } from "./lib/email/email-processor";
import { logger } from "./lib/log/logger";
import pinoHttp from "pino-http";
import Redis from "ioredis";
import { IncomingMessage, ServerResponse } from "http";
import {
  StepType,
  StepPriority,
  StepTiming,
  StepStatus,
  BusinessHours,
} from "@mailjot/types";
import type { ProcessingJob } from "./types/queue";
import { resetSequence } from "./lib/sequence/helper";
import { rateLimiter } from "./lib/rate-limit/rate-limiter";
import { memoryMonitor } from "./lib/monitor/memory-monitor";

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

// app.use(httpLogger);

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

// Helper function to get business hours
async function getBusinessHours(
  userId: string
): Promise<BusinessHours | undefined> {
  const settings = await prisma.businessHours.findFirst({
    where: { userId },
  });

  if (!settings) {
    return undefined;
  }

  return {
    timezone: settings.timezone,
    workDays: settings.workDays,
    workHoursStart: settings.workHoursStart,
    workHoursEnd: settings.workHoursEnd,
    holidays: settings.holidays,
  };
}

// Health check endpoints
app.get("/api/health", async (req, res) => {
  try {
    // Check Redis connection
    const redisStatus = await redis.ping();

    // Check queue status
    const queueStatus = await queueService.getDetailedQueueStatus();

    // Get queue metrics
    const metrics = await monitoringService.getSystemMetrics();

    res.json({
      status: "ok",
      redis: redisStatus === "PONG" ? "connected" : "error",
      queues: {
        sequence: queueStatus.sequence,
        email: queueStatus.email,
      },
      metrics,
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Queue status endpoint
app.get("/api/queues/status", async (req, res) => {
  try {
    const [detailedStatus, jobCounts] = await Promise.all([
      queueService.getDetailedQueueStatus(),
      queueService.getJobCounts(),
    ]);

    res.json({
      sequence: {
        ...detailedStatus.sequence,
        isProcessing: detailedStatus.sequence.active > 0,
      },
      email: {
        ...detailedStatus.email,
        isProcessing: detailedStatus.email.active > 0,
      },
      total: jobCounts,
    });
  } catch (error) {
    logger.error("Error getting queue status:", error);
    res.status(500).json({ error: "Failed to get queue status" });
  }
});

// Launch sequence
app.post("/api/sequences/:id/launch", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, testMode = false } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get sequence and validate
    const sequence = await prisma.sequence.findUnique({
      where: {
        id,
        userId,
      },
      include: {
        steps: {
          orderBy: { order: "asc" },
        },
        contacts: {
          where: {
            status: {
              notIn: ["completed", "opted_out"],
            },
          },
          include: {
            contact: true,
          },
        },
      },
    });

    if (!sequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }

    if (sequence.steps.length === 0) {
      return res.status(400).json({ error: "Sequence has no steps" });
    }

    // TODOD : check if contacts exist. No need to get them
    if (sequence.contacts.length === 0) {
      return res.status(400).json({ error: "Sequence has no active contacts" });
    }

    // Get business hours settings
    const businessHours = await getBusinessHours(userId);

    // Update sequence status
    // TODO : check if sequence is already active and make it active if fully processed
    await prisma.sequence.update({
      where: { id },
      data: {
        status: "active",
        testMode,
      },
    });

    // Create and schedule the job
    const processingJob: ProcessingJob = {
      type: "sequence",
      id: `sequence-${id}-${Date.now()}`,
      priority: 1,
      data: {
        sequenceId: id,
        userId,
        scheduleType: businessHours ? "business" : "custom",
        businessHours,
        testMode,
      },
    };

    // Add the job to the queue
    const job = await queueService.addSequenceJob(processingJob);

    // Start monitoring the sequence
    await monitoringService.startMonitoring(id);

    res.json({
      success: true,
      jobId: job.id,
      contactCount: sequence.contacts.length,
      stepCount: sequence.steps.length,
    });
  } catch (error) {
    logger.error("Error launching sequence:", error);
    res.status(500).json({ error: "Failed to launch sequence" });
  }
});

// Get job status
app.get("/api/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    // Get job counts
    const counts = await queueService.getJobCounts();

    // Get system metrics
    const metrics = await monitoringService.getSystemMetrics();

    res.json({
      counts,
      metrics,
    });
  } catch (error) {
    logger.error("Error getting job status:", error);
    res.status(500).json({ error: "Failed to get job status" });
  }
});

// Get sequence health
app.get("/api/sequences/:id/health", async (req, res) => {
  try {
    const { id } = req.params;
    const health = await monitoringService.checkSequenceHealth(id, {
      errorThreshold: 0.1,
      warningThreshold: 0.05,
      criticalThreshold: 0.2,
      checkInterval: 5 * 60 * 1000,
      retryInterval: 60 * 1000,
      maxRetries: 3,
      channels: {
        email: [process.env.ALERT_EMAIL_TO || ""],
      },
    });

    res.json(health);
  } catch (error) {
    logger.error("Error getting sequence health:", error);
    res.status(500).json({ error: "Failed to get sequence health" });
  }
});

// Get system metrics
app.get("/api/metrics", async (req, res) => {
  try {
    const metrics = await monitoringService.getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error("Error getting system metrics:", error);
    res.status(500).json({ error: "Failed to get system metrics" });
  }
});

// Pause sequence processing
app.post("/api/sequences/:id/pause", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Validate sequence ownership
    const sequence = await prisma.sequence.findUnique({
      where: {
        id,
        userId,
      },
    });

    if (!sequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }

    // Update sequence status
    await prisma.sequence.update({
      where: { id },
      data: { status: "paused" },
    });

    // Stop monitoring
    await monitoringService.stopMonitoring(id);

    res.json({ success: true });
  } catch (error) {
    logger.error("Error pausing sequence:", error);
    res.status(500).json({ error: "Failed to pause sequence" });
  }
});

// Resume sequence processing
app.post("/api/sequences/:id/resume", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Validate sequence ownership
    const sequence = await prisma.sequence.findUnique({
      where: {
        id,
        userId,
      },
    });

    if (!sequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }

    // Update sequence status
    await prisma.sequence.update({
      where: { id },
      data: { status: "active" },
    });

    // Resume monitoring
    await monitoringService.startMonitoring(id);

    res.json({ success: true });
  } catch (error) {
    logger.error("Error resuming sequence:", error);
    res.status(500).json({ error: "Failed to resume sequence" });
  }
});

// Reset sequence
app.post("/api/sequences/:id/reset", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Verify sequence ownership
    const sequence = await prisma.sequence.findUnique({
      where: {
        id,
        userId,
      },
    });

    if (!sequence) {
      return res.status(404).json({ error: "Sequence not found" });
    }

    // Stop monitoring
    await monitoringService.stopMonitoring(id);
    logger.info(`Stopped monitoring sequence ${id}`);

    // Reset rate limits
    await rateLimiter.resetLimits(userId, id);
    logger.info(`Rate limits reset for sequence ${id}`);

    // Reset sequence data
    await resetSequence(id);
    logger.info(`Sequence data reset for ${id}`);

    // Update sequence status
    await prisma.sequence.update({
      where: { id },
      data: {
        status: "draft",
        testMode: false,
      },
    });
    logger.info(`Sequence status reset to draft`);

    res.json({
      success: true,
      message: "Sequence reset successfully",
    });
  } catch (error) {
    logger.error("Error resetting sequence:", error);
    res.status(500).json({ error: "Failed to reset sequence" });
  }
});

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received. Starting graceful shutdown...");
  await handleShutdown();
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received. Starting graceful shutdown...");
  await handleShutdown();
});

async function handleShutdown() {
  try {
    logger.info("🛑 Starting graceful shutdown...");

    // Stop memory monitoring
    memoryMonitor.stopMonitoring();

    // Stop accepting new requests
    server.close(() => {
      logger.info("✓ HTTP server closed");
    });

    // Clean up queues before shutting down
    await queueService.cleanup();

    // Close database connections
    await prisma.$disconnect();

    logger.info("✓ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
}

// Start the server
const server = app.listen(port, () => {
  logger.info(`Queue service listening on port ${port}`);
});
