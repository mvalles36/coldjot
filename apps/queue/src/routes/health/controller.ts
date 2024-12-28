import { Request, Response } from "express";
import { QueueService } from "@/services/queue/queue-service";
import { MonitoringService } from "@/services/monitor/monitoring-service";
import { logger } from "@/lib/log";
import Redis from "ioredis";

// Initialize services
const queueService = QueueService.getInstance();
const monitoringService = new MonitoringService(queueService);
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

export async function checkHealth(req: Request, res: Response) {
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
}

export async function getQueueStatus(req: Request, res: Response) {
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
}
