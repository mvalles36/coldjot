import { prisma } from "@mailjot/database";
import {
  AlertConfig,
  SequenceHealth,
  SystemMetrics,
  QueueMetrics,
} from "../types/queue";
import { logger } from "./logger";
import { QueueService } from "./queue-service";
import os from "os";

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
        stats.sentEmails > 0
          ? (stats.sentEmails - stats.bouncedEmails) / stats.sentEmails
          : 1;
      const bounceRate =
        stats.sentEmails > 0 ? stats.bouncedEmails / stats.sentEmails : 0;
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
        errorCount: stats.failedEmails,
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
    const jobs = await this.queueService.getCompletedJobs(sequenceId);
    const totalJobs = jobs.length;

    if (totalJobs === 0) {
      return {
        processingRate: 0,
        errorRate: 0,
        avgProcessingTime: 0,
        throughput: 0,
      };
    }

    const failedJobs = jobs.filter((job) => job.failedReason).length;
    const processingTimes = jobs.map((job) => job.processedOn! - job.timestamp);
    const avgProcessingTime =
      processingTimes.reduce((a, b) => a + b, 0) / totalJobs;

    // Calculate metrics for the last hour
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recentJobs = jobs.filter((job) => job.processedOn! > hourAgo);
    const throughput = recentJobs.length;

    return {
      processingRate: totalJobs / (Date.now() - jobs[0].timestamp),
      errorRate: failedJobs / totalJobs,
      avgProcessingTime,
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
