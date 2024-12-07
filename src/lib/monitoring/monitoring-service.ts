import { queueService } from "@/lib/queue/queue-service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { QUEUE_NAMES } from "@/lib/queue/queue-config";
import type { QueueMetrics } from "@/lib/queue/types";

class MonitoringService {
  private readonly ALERT_THRESHOLDS = {
    ERROR_RATE: 0.1, // 10% error rate
    PROCESSING_TIME: 30000, // 30 seconds
    QUEUE_SIZE: 1000,
    FAILED_JOBS: 100,
  };

  async collectMetrics(): Promise<void> {
    try {
      const metrics: Record<string, QueueMetrics> = {};

      // Collect metrics for all queues
      for (const queueName of Object.values(QUEUE_NAMES)) {
        metrics[queueName] = await queueService.getQueueMetrics(queueName);
      }

      // Store metrics in database
      await prisma.queueMetrics.create({
        data: {
          timestamp: new Date(),
          metrics: metrics as any,
        },
      });

      // Check for alerts
      await this.checkAlerts(metrics);

      logger.info("Metrics collected successfully");
    } catch (error) {
      logger.error("Error collecting metrics:", error);
      throw error;
    }
  }

  private async checkAlerts(
    metrics: Record<string, QueueMetrics>
  ): Promise<void> {
    const alerts = [];

    for (const [queueName, queueMetrics] of Object.entries(metrics)) {
      // Check error rate
      if (queueMetrics.errorRate > this.ALERT_THRESHOLDS.ERROR_RATE) {
        alerts.push({
          type: "error_rate",
          queue: queueName,
          value: queueMetrics.errorRate,
          threshold: this.ALERT_THRESHOLDS.ERROR_RATE,
        });
      }

      // Check processing time
      if (queueMetrics.processingTime > this.ALERT_THRESHOLDS.PROCESSING_TIME) {
        alerts.push({
          type: "processing_time",
          queue: queueName,
          value: queueMetrics.processingTime,
          threshold: this.ALERT_THRESHOLDS.PROCESSING_TIME,
        });
      }

      // Check queue size
      if (queueMetrics.size > this.ALERT_THRESHOLDS.QUEUE_SIZE) {
        alerts.push({
          type: "queue_size",
          queue: queueName,
          value: queueMetrics.size,
          threshold: this.ALERT_THRESHOLDS.QUEUE_SIZE,
        });
      }

      // Check failed jobs
      if (queueMetrics.failed > this.ALERT_THRESHOLDS.FAILED_JOBS) {
        alerts.push({
          type: "failed_jobs",
          queue: queueName,
          value: queueMetrics.failed,
          threshold: this.ALERT_THRESHOLDS.FAILED_JOBS,
        });
      }
    }

    // Store alerts if any
    if (alerts.length > 0) {
      await prisma.queueAlert.createMany({
        data: alerts.map((alert) => ({
          type: alert.type,
          queueName: alert.queue,
          value: alert.value.toString(),
          threshold: alert.threshold.toString(),
          timestamp: new Date(),
        })),
      });

      // Log alerts
      alerts.forEach((alert) => {
        logger.warn(
          `Queue alert: ${alert.type} in ${alert.queue} (${alert.value} > ${alert.threshold})`
        );
      });
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    issues: Array<{
      queue: string;
      type: string;
      message: string;
    }>;
  }> {
    try {
      const metrics: Record<string, QueueMetrics> = {};
      const issues = [];

      // Collect current metrics
      for (const queueName of Object.values(QUEUE_NAMES)) {
        metrics[queueName] = await queueService.getQueueMetrics(queueName);

        const queueMetrics = metrics[queueName];

        // Check for paused queues
        if (queueMetrics.paused) {
          issues.push({
            queue: queueName,
            type: "paused",
            message: "Queue is paused",
          });
        }

        // Check for high error rates
        if (queueMetrics.errorRate > this.ALERT_THRESHOLDS.ERROR_RATE) {
          issues.push({
            queue: queueName,
            type: "error_rate",
            message: `High error rate: ${(queueMetrics.errorRate * 100).toFixed(
              1
            )}%`,
          });
        }

        // Check for processing delays
        if (
          queueMetrics.processingTime > this.ALERT_THRESHOLDS.PROCESSING_TIME
        ) {
          issues.push({
            queue: queueName,
            type: "processing_time",
            message: `Slow processing: ${(
              queueMetrics.processingTime / 1000
            ).toFixed(1)}s`,
          });
        }

        // Check for queue backlog
        if (queueMetrics.waiting > this.ALERT_THRESHOLDS.QUEUE_SIZE) {
          issues.push({
            queue: queueName,
            type: "backlog",
            message: `Large backlog: ${queueMetrics.waiting} jobs waiting`,
          });
        }
      }

      return {
        healthy: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error("Error checking health status:", error);
      return {
        healthy: false,
        issues: [
          {
            queue: "system",
            type: "error",
            message: "Failed to check health status",
          },
        ],
      };
    }
  }

  async cleanup(): Promise<void> {
    try {
      const oldMetricsDate = new Date();
      oldMetricsDate.setDate(oldMetricsDate.getDate() - 7); // Keep 7 days of metrics

      const oldAlertsDate = new Date();
      oldAlertsDate.setDate(oldAlertsDate.getDate() - 30); // Keep 30 days of alerts

      await Promise.all([
        // Clean up old metrics
        prisma.queueMetrics.deleteMany({
          where: {
            timestamp: {
              lt: oldMetricsDate,
            },
          },
        }),

        // Clean up old alerts
        prisma.queueAlert.deleteMany({
          where: {
            timestamp: {
              lt: oldAlertsDate,
            },
          },
        }),
      ]);

      logger.info("Monitoring cleanup completed");
    } catch (error) {
      logger.error("Error cleaning up monitoring data:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
