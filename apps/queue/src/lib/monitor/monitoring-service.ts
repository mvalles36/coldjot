import { prisma } from "@mailjot/database";
import {
  AlertConfig,
  SequenceHealth,
  SystemMetrics,
  QueueMetrics,
  JobCounts,
} from "@/types/queue";
import { logger } from "@/lib/log/logger";
import { QueueService } from "@/lib/queue/queue-service";
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

    // Initialize sequence stats if they don't exist
    await this.initializeSequenceStats(sequenceId);

    // Start health check interval
    const interval = setInterval(
      () => this.checkSequenceHealth(sequenceId, alertConfig),
      alertConfig.checkInterval
    );

    this.checkIntervals.set(sequenceId, interval);
    logger.info(`Started monitoring sequence ${sequenceId}`);
  }

  // Initialize sequence stats
  private async initializeSequenceStats(sequenceId: string): Promise<void> {
    const existingStats = await prisma.sequenceStats.findFirst({
      where: { sequenceId },
    });

    if (!existingStats) {
      await prisma.sequenceStats.create({
        data: {
          sequenceId,
          totalEmails: 0,
          sentEmails: 0,
          openedEmails: 0,
          uniqueOpens: 0,
          clickedEmails: 0,
          repliedEmails: 0,
          bouncedEmails: 0,
          failedEmails: 0,
          unsubscribed: 0,
          interested: 0,
          peopleContacted: 0,
          openRate: 0,
          clickRate: 0,
          replyRate: 0,
          bounceRate: 0,
        },
      });
      logger.info(`Initialized stats for sequence ${sequenceId}`);
    }
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
        // Try to initialize stats if they don't exist
        await this.initializeSequenceStats(sequenceId);

        // Return default health status
        return {
          sequenceId,
          status: "healthy",
          errorCount: 0,
          lastCheck: new Date(),
          metrics: {
            deliveryRate: 1,
            bounceRate: 0,
            errorRate: 0,
            processingTime: 0,
          },
        };
      }

      // Get queue metrics for this sequence
      const queueMetrics = await this.getQueueMetrics(sequenceId);

      // Calculate health metrics with null checks
      const sentEmails = stats.sentEmails || 0;
      const bouncedEmails = stats.bouncedEmails || 0;
      const failedEmails = stats.failedEmails || 0;

      const deliveryRate =
        sentEmails > 0 ? (sentEmails - bouncedEmails) / sentEmails : 1;
      const bounceRate = sentEmails > 0 ? bouncedEmails / sentEmails : 0;
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
        errorCount: failedEmails,
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
    await prisma.sequenceHealth.upsert({
      where: {
        sequenceId: health.sequenceId,
      },
      create: {
        sequenceId: health.sequenceId,
        status: health.status,
        errorCount: health.errorCount,
        lastCheck: health.lastCheck,
        lastError: health.lastError,
        metrics: health.metrics as any, // Prisma will handle JSON serialization
      },
      update: {
        status: health.status,
        errorCount: health.errorCount,
        lastCheck: health.lastCheck,
        lastError: health.lastError,
        metrics: health.metrics as any,
      },
    });
  }
}
