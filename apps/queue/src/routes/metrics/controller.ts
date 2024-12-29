import { Request, Response } from "express";
import { QueueService } from "@/services/v1/queue/queue-service";
import { MonitoringService } from "@/services/v1/monitor/monitoring-service";
import { logger } from "@/lib/log";

// Initialize services
const queueService = QueueService.getInstance();
const monitoringService = new MonitoringService(queueService);

export async function getSystemMetrics(req: Request, res: Response) {
  try {
    const metrics = await monitoringService.getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error("Error getting system metrics:", error);
    res.status(500).json({ error: "Failed to get system metrics" });
  }
}

export async function getSequenceHealth(req: Request, res: Response) {
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
}
