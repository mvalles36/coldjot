import { prisma } from "@mailjot/database";
import {
  AlertConfig,
  SequenceHealth,
  SystemMetrics,
  QueueMetrics,
  JobCounts,
} from "../types/queue";
import { logger } from "./logger";
import { QueueService } from "./queue/queue-service";
import os from "os";
import Bull from "bull";

interface CompletedJob {
  id: string;
  timestamp: number;
  processedOn: number;
  failedReason?: string;
  data: {
    sequenceId?: string;
  };
}

export class MonitoringService {
  private defaultAlertConfig: AlertConfig = {
    errorThreshold: 0.1, // 10% error rate
    warningThreshold: 0.05, // 5% error rate
    criticalThreshold: 0.2, // 20% error rate
    checkInterval: 5 * 60 * 1000, // 5 minutes
    retryInterval: 60 * 1000, // 1 minute
    maxRetries: 3,
    channels: {
      email: [process.env.ALERT_EMAIL_TO || ""],
    },
  };

  private queueService: QueueService;
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(queueService: QueueService) {
    this.queueService = queueService;
  }

  // Start monitoring a sequence
  async startMonitoring(
    sequenceId: string,
    config?: Partial<AlertConfig>
  ): Promise<void> {
    const alertConfig = { ...this.defaultAlertConfig, ...config };

    // Stop existing monitoring if any
    this.stopMonitoring(sequenceId);

    // Start health check interval
    const interval = setInterval(
      () => this.checkSequenceHealth(sequenceId, alertConfig),
      alertConfig.checkInterval
    );

    this.checkIntervals.set(sequenceId, interval);
    logger.info(`Started monitoring sequence ${sequenceId}`);
  }

  // Stop monitoring a sequence
  stopMonitoring(sequenceId: string): void {
    const interval = this.checkIntervals.get(sequenceId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(sequenceId);
      logger.info(`Stopped monitoring sequence ${sequenceId}`);
    }
  }

  // Check sequence health
  async checkSequenceHealth(
    sequenceId: string,
    config: AlertConfig
  ): Promise<SequenceHealth> {
    try {
      // Get sequence stats
      const stats = await prisma.sequenceStats.findFirst({
        where: { sequenceId },
      });

      if (!stats) {
        throw new Error("Sequence stats not found");
      }

      // Get queue metrics for this sequence
      const queueMetrics = await this.getQueueMetrics(sequenceId);

      // Calculate health metrics
      const deliveryRate =
        stats.sentEmails && stats.sentEmails > 0
          ? (stats.sentEmails! - stats.bouncedEmails!) / stats.sentEmails
          : 1;
      const bounceRate =
        stats.sentEmails && stats.sentEmails > 0
          ? stats.bouncedEmails! / stats.sentEmails
          : 0;
      const errorRate = queueMetrics.errorRate;

      // Determine health status
      let status: SequenceHealth["status"] = "healthy";
      if (errorRate >= config.criticalThreshold) {
        status = "critical";
      } else if (errorRate >= config.errorThreshold) {
        status = "error";
      } else if (errorRate >= config.warningThreshold) {
        status = "warning";
      }

      const health: SequenceHealth = {
        sequenceId,
        status,
        errorCount: stats.failedEmails ?? 0,
        lastCheck: new Date(),
        metrics: {
          deliveryRate,
          bounceRate,
          errorRate,
          processingTime: queueMetrics.avgProcessingTime,
        },
      };

      // Store health check result
      await this.storeHealthCheck(health);

      return health;
    } catch (error) {
      logger.error(`Health check failed for sequence ${sequenceId}:`, error);
      throw error;
    }
  }

  // Get system metrics
  async getSystemMetrics(): Promise<SystemMetrics> {
    const queueCounts = await this.queueService.getJobCounts();
    const queueMetrics = await this.getQueueMetrics();

    return {
      queueSize: queueCounts.waiting + queueCounts.active,
      processingRate: queueMetrics.processingRate,
      errorRate: queueMetrics.errorRate,
      cpuUsage: os.loadavg()[0], // 1 minute load average
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      activeWorkers: queueCounts.active,
      jobsCompleted: queueCounts.completed,
      jobsFailed: queueCounts.failed,
    };
  }

  // Get queue metrics for a specific sequence or overall
  private async getQueueMetrics(sequenceId?: string): Promise<QueueMetrics> {
    const queueStatus = await this.queueService.getDetailedQueueStatus();
    const totalJobs =
      queueStatus.sequence.completed + queueStatus.email.completed;

    if (totalJobs === 0) {
      return {
        processingRate: 0,
        errorRate: 0,
        avgProcessingTime: 0,
        throughput: 0,
      };
    }

    const failedJobs = queueStatus.sequence.failed + queueStatus.email.failed;
    const errorRate = failedJobs / totalJobs;

    // Since we can't get detailed job timing info directly from Bull's getJobCounts,
    // we'll use a simpler metric for processing rate and throughput
    const processingRate =
      queueStatus.sequence.active + queueStatus.email.active;
    const throughput = totalJobs;

    return {
      processingRate: processingRate / 60, // jobs per second
      errorRate,
      avgProcessingTime: 0, // Not available without detailed job info
      throughput,
    };
  }

  // Store health check result
  private async storeHealthCheck(health: SequenceHealth): Promise<void> {
    await prisma.sequenceHealth.create({
      data: {
        sequenceId: health.sequenceId,
        status: health.status,
        errorCount: health.errorCount,
        lastCheck: health.lastCheck,
        lastError: health.lastError,
        metrics: health.metrics as any, // Prisma will handle JSON serialization
      },
    });
  }
}
