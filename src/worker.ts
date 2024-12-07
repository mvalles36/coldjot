import { queueService } from "@/lib/queue/queue-service";
import { sequenceProcessor } from "@/lib/sequence/sequence-processor";
import { emailProcessor } from "@/lib/email/email-processor";
import { monitoringService } from "@/lib/monitoring/monitoring-service";
import { QUEUE_NAMES, JOB_TYPES } from "@/lib/queue/queue-config";
import { logger } from "@/lib/logger";
import type { MonitoringJob, CleanupJob } from "@/lib/queue/types";

async function startWorker() {
  try {
    logger.info("Starting queue worker...");

    // Initialize queue service
    await queueService.initialize();

    // Process sequence jobs
    queueService.processJobs(QUEUE_NAMES.PROCESSING, async (job) => {
      logger.info(`Processing sequence job: ${job.id}`);

      const { type, data } = job.data;

      switch (type) {
        case "sequence":
          await sequenceProcessor.processSequence(data.sequenceId, data.userId);
          break;
        case "step":
          await sequenceProcessor.processStep(
            data.sequenceId,
            data.stepId,
            data.contactId,
            data.userId
          );
          break;
        default:
          throw new Error(`Unknown sequence job type: ${type}`);
      }

      return { success: true };
    });

    // Process email jobs
    queueService.processJobs(QUEUE_NAMES.SENDING, async (job) => {
      logger.info(`Processing email job: ${job.id}`);

      const { type } = job.data;

      switch (type) {
        case "send":
          await emailProcessor.processEmail(job.data);
          break;
        case "bounce_check":
          await emailProcessor.checkBounce(job.data);
          break;
        default:
          throw new Error(`Unknown email job type: ${type}`);
      }

      return { success: true };
    });

    // Process monitoring jobs
    queueService.processJobs(QUEUE_NAMES.MONITORING, async (job) => {
      logger.info(`Processing monitoring job: ${job.id}`);

      const { type } = job.data;

      switch (type) {
        case JOB_TYPES.HEALTH_CHECK:
          await monitoringService.getHealthStatus();
          break;
        case JOB_TYPES.COLLECT_METRICS:
          await monitoringService.collectMetrics();
          break;
        default:
          throw new Error(`Unknown monitoring job type: ${type}`);
      }

      return { success: true };
    });

    // Process cleanup jobs
    queueService.processJobs(QUEUE_NAMES.CLEANUP, async (job) => {
      logger.info(`Processing cleanup job: ${job.id}`);

      const { type } = job.data;

      switch (type) {
        case JOB_TYPES.CLEANUP_OLD_JOBS:
          await monitoringService.cleanup();
          break;
        default:
          throw new Error(`Unknown cleanup job type: ${type}`);
      }

      return { success: true };
    });

    // Schedule recurring jobs
    const healthCheckJob: MonitoringJob = {
      id: "health-check",
      type: "health_check",
      priority: 1,
      timestamp: new Date(),
      userId: "system",
      data: {
        scope: "system",
      },
      repeat: { every: 5 * 60 * 1000 }, // Every 5 minutes
    };

    const metricsJob: MonitoringJob = {
      id: "collect-metrics",
      type: "metrics",
      priority: 2,
      timestamp: new Date(),
      userId: "system",
      data: {
        scope: "system",
      },
      repeat: { every: 15 * 60 * 1000 }, // Every 15 minutes
    };

    const cleanupJob: CleanupJob = {
      id: "cleanup",
      type: "cleanup",
      priority: 3,
      timestamp: new Date(),
      userId: "system",
      data: {
        target: "jobs",
        olderThan: new Date(),
      },
      repeat: { every: 24 * 60 * 60 * 1000 }, // Every 24 hours
    };

    // Add recurring jobs
    await Promise.all([
      queueService.addMonitoringJob(healthCheckJob),
      queueService.addMonitoringJob(metricsJob),
      queueService.addCleanupJob(cleanupJob),
    ]);

    logger.info("Queue worker started successfully");
  } catch (error) {
    logger.error("Error starting queue worker:", error);
    process.exit(1);
  }
}

// Handle process signals
process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await queueService.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Received SIGINT signal");
  await queueService.shutdown();
  process.exit(0);
});

// Start the worker
startWorker();
