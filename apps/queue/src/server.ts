import express from "express";
import cors from "cors";
import { env } from "./config";
import { prisma } from "@mailjot/database";
import { queueService } from "./lib/queue/queue-service";
import { SchedulingService } from "./lib/scheduling-service";
import { MonitoringService } from "./lib/monitoring-service";
import { logger } from "./lib/logger";
import pinoHttp, { HttpLogger, Options } from "pino-http";
import { IncomingMessage, ServerResponse } from "http";
import {
  StepType,
  StepPriority,
  StepTiming,
  StepStatus,
  BusinessHours,
} from "@mailjot/types";
import type { ProcessingJob } from "./types/queue";

const app = express();
const port = 3001;

// Initialize services
const schedulingService = new SchedulingService();
const monitoringService = new MonitoringService(queueService);

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

app.get("/api/health", (req, res) => {
  console.log("health check");
  res.json({ status: "ok" });
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

    if (sequence.contacts.length === 0) {
      return res.status(400).json({ error: "Sequence has no active contacts" });
    }

    // Get business hours settings
    const businessHours = await getBusinessHours(userId);

    // Update sequence status
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

// Add queue status endpoint
app.get("/api/queue/status", async (req, res) => {
  try {
    const [detailedStatus, jobCounts] = await Promise.all([
      queueService.getDetailedQueueStatus(),
      queueService.getJobCounts(),
    ]);

    const status = {
      sequence: detailedStatus.sequence,
      email: detailedStatus.email,
      total: jobCounts,
    };

    res.json(status);
  } catch (error) {
    logger.error("Error getting queue status:", error);
    res.status(500).json({ error: "Failed to get queue status" });
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
    // Stop accepting new requests
    server.close(() => {
      logger.info("HTTP server closed");
    });

    // Shutdown queue service
    // await queueService.shutdown();b

    // Close database connections
    await prisma.$disconnect();

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// Start the server
const server = app.listen(port, () => {
  logger.info(`Queue service listening on port ${port}`);
});
