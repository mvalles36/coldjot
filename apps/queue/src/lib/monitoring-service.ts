import { prisma } from "@mailjot/database";
import { AlertConfig, SequenceHealth, SystemMetrics } from "../types/queue";
import { logger } from "./logger";
import { queueService } from "./queue-service";

export class MonitoringService {
  private defaultAlertConfig: AlertConfig = {
    thresholds: {
      bounceRate: 0.05, // 5%
      errorRate: 0.1, // 10%
      processingDelay: 15 * 60 * 1000, // 15 minutes
      queueSize: 1000,
    },
    channels: {
      email: true,
      slack: false,
      dashboard: true,
    },
    rules: [
      {
        condition: "bounceRate > threshold",
        severity: "error",
        action: "pause",
      },
      {
        condition: "errorRate > threshold",
        severity: "warning",
        action: "notify",
      },
      {
        condition: "processingDelay > threshold",
        severity: "warning",
        action: "notify",
      },
      {
        condition: "queueSize > threshold",
        severity: "info",
        action: "notify",
      },
    ],
  };

  async checkSequenceHealth(sequenceId: string): Promise<SequenceHealth> {
    try {
      // Get sequence and its stats
      const sequence = await prisma.sequence.findUnique({
        where: { id: sequenceId },
        include: {
          stats: true,
          steps: true,
        },
      });

      if (!sequence) {
        throw new Error("Sequence not found");
      }

      // Get sequence stats
      const stats = await prisma.sequenceStats.findFirst({
        where: { sequenceId },
      });

      if (!stats) {
        throw new Error("Sequence stats not found");
      }

      // Calculate metrics
      const metrics = {
        bounceRate: stats.bouncedEmails / stats.totalEmails || 0,
        errorRate: stats.failedEmails / stats.totalEmails || 0,
        deliveryRate: stats.sentEmails / stats.totalEmails || 0,
        processingDelay: this.calculateProcessingDelay(sequence.steps),
      };

      // Determine status based on metrics
      const status = this.determineHealthStatus(metrics);

      // Identify issues
      const issues = this.identifyIssues(metrics);

      return {
        id: sequenceId,
        status,
        metrics,
        issues,
      };
    } catch (error) {
      logger.error("Error checking sequence health:", error);
      throw error;
    }
  }

  private calculateProcessingDelay(steps: any[]): number {
    // TODO: Implement processing delay calculation
    return 0;
  }

  private determineHealthStatus(metrics: {
    bounceRate: number;
    errorRate: number;
    deliveryRate: number;
    processingDelay: number;
  }): "healthy" | "warning" | "error" {
    if (metrics.bounceRate > 0.1 || metrics.errorRate > 0.2) {
      return "error";
    }
    if (metrics.bounceRate > 0.05 || metrics.errorRate > 0.1) {
      return "warning";
    }
    return "healthy";
  }

  private identifyIssues(metrics: {
    bounceRate: number;
    errorRate: number;
    deliveryRate: number;
    processingDelay: number;
  }): {
    type: "error" | "rate_limit" | "bounce" | "delay";
    severity: "low" | "medium" | "high";
    message: string;
  }[] {
    const issues: {
      type: "error" | "rate_limit" | "bounce" | "delay";
      severity: "low" | "medium" | "high";
      message: string;
    }[] = [];

    if (metrics.bounceRate > 0.1) {
      issues.push({
        type: "bounce",
        severity: "high",
        message: "High bounce rate detected",
      });
    } else if (metrics.bounceRate > 0.05) {
      issues.push({
        type: "bounce",
        severity: "medium",
        message: "Elevated bounce rate detected",
      });
    }

    if (metrics.errorRate > 0.2) {
      issues.push({
        type: "error",
        severity: "high",
        message: "High error rate detected",
      });
    } else if (metrics.errorRate > 0.1) {
      issues.push({
        type: "error",
        severity: "medium",
        message: "Elevated error rate detected",
      });
    }

    if (metrics.processingDelay > 15 * 60 * 1000) {
      issues.push({
        type: "delay",
        severity: "high",
        message: "Significant processing delay detected",
      });
    }

    return issues;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    return queueService.getSystemMetrics();
  }

  async handleAlert(
    type: string,
    message: string,
    severity: "info" | "warning" | "error"
  ) {
    // Log the alert
    logger.info(`Alert [${severity}] ${type}: ${message}`);

    // Store the alert in the database
    await prisma.queueAlert.create({
      data: {
        type,
        queueName: "sequence",
        value: message,
        threshold: "N/A",
      },
    });

    // TODO: Implement notification sending based on alert config
  }

  async checkSystemHealth() {
    try {
      const metrics = await this.getSystemMetrics();

      // Check queue sizes
      for (const queue of metrics.queues) {
        if (queue.size > this.defaultAlertConfig.thresholds.queueSize) {
          await this.handleAlert(
            "queue_size",
            `Queue ${queue.name} has exceeded size threshold: ${queue.size} jobs`,
            "warning"
          );
        }

        if (queue.failed > 0) {
          await this.handleAlert(
            "failed_jobs",
            `Queue ${queue.name} has ${queue.failed} failed jobs`,
            "error"
          );
        }
      }

      // Check error rate
      if (
        metrics.performance.errorRate >
        this.defaultAlertConfig.thresholds.errorRate
      ) {
        await this.handleAlert(
          "error_rate",
          `System error rate has exceeded threshold: ${(
            metrics.performance.errorRate * 100
          ).toFixed(1)}%`,
          "error"
        );
      }

      // Store metrics
      await prisma.queueMetrics.create({
        data: {
          metrics: metrics as any,
        },
      });
    } catch (error) {
      logger.error("Error checking system health:", error);
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
