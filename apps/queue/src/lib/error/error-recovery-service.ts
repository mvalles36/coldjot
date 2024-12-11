import { prisma } from "@mailjot/database";
import { ErrorRecovery, RetryStrategy } from "@/types/queue";
import { logger } from "@/lib/log/logger";
import { alertService } from "@/lib/alert/alert-service";
import Bull from "bull";

export class ErrorRecoveryService {
  private defaultRetryStrategy: RetryStrategy = {
    maxRetries: 3,
    backoffType: "exponential",
    backoffDelay: 60 * 1000, // 1 minute
    maxDelay: 24 * 60 * 60 * 1000, // 24 hours
    shouldRetry: (error: Error) => {
      // Don't retry on certain error types
      const nonRetryableErrors = [
        "InvalidCredentialsError",
        "RateLimitExceededError",
        "InvalidRecipientError",
      ];
      return !nonRetryableErrors.some((type) => error.name === type);
    },
  };
  // Default error recovery configuration
  private defaultErrorRecovery: ErrorRecovery = {
    jobId: "",
    error: "",
    retryCount: 0,
    lastRetry: new Date(),
    strategy: this.defaultRetryStrategy,
    status: "pending",
    metadata: {
      type: "auto",
      notification: {
        users: [],
        message: "Automatic recovery attempt in progress",
        action: "review",
      },
    },
  };

  async handleJobError(
    job: Bull.Job,
    error: Error,
    retryStrategy: RetryStrategy = this.defaultRetryStrategy,
    recoveryConfig: ErrorRecovery = {
      ...this.defaultErrorRecovery,
      jobId: job.id.toString(),
      error: error.message,
    }
  ) {
    try {
      // Log the error
      logger.error(`Error in job ${job.id}:`, error);

      // Create error record
      const errorRecord = await prisma.queueError.create({
        data: {
          jobId: job.id.toString(),
          queueName: job.queue.name,
          error: error.message,
          stack: error.stack || "",
          attempt: job.attemptsMade,
          timestamp: new Date(),
        },
      });

      // Check if we should retry
      if (
        job.attemptsMade < retryStrategy.maxRetries &&
        retryStrategy.shouldRetry?.(error)
      ) {
        await this.handleRetry(job, error, retryStrategy);
      } else {
        await this.handleFinalFailure(
          job,
          error,
          retryStrategy,
          recoveryConfig
        );
      }

      return errorRecord;
    } catch (err) {
      logger.error("Error in error recovery:", err);
      throw err;
    }
  }

  private async handleRetry(
    job: Bull.Job,
    error: Error,
    retryStrategy: RetryStrategy
  ) {
    const delay = this.calculateRetryDelay(job.attemptsMade, retryStrategy);

    // Update job options for next attempt
    await job.update({
      ...job.data,
      _retryCount: job.attemptsMade,
      _lastError: error.message,
    });

    // Add job back to queue with delay
    await job.queue.add(job.data, {
      delay,
      attempts: retryStrategy.maxRetries - job.attemptsMade,
      backoff: {
        type: retryStrategy.backoffType,
        delay: retryStrategy.backoffDelay,
      },
    });

    // Remove the failed job
    await job.remove();

    // Log retry attempt
    logger.info(
      `Scheduled retry #${job.attemptsMade + 1} for job ${job.id} in ${
        delay / 1000
      }s`
    );
  }

  private async handleFinalFailure(
    job: Bull.Job,
    error: Error,
    retryStrategy: RetryStrategy,
    recoveryConfig: ErrorRecovery
  ) {
    // Handle based on recovery config
    switch (recoveryConfig.status) {
      case "failed":
        await job.moveToFailed(error, true);
        break;
      case "recovered":
        await job.moveToCompleted("Recovered after failure", true);
        break;
      default:
        await job.moveToFailed(error, true);
    }

    // Send notifications
    await this.notifyFailure(job, error, recoveryConfig);
  }

  private calculateRetryDelay(
    attemptsMade: number,
    retryStrategy: RetryStrategy
  ): number {
    const { backoffType, backoffDelay, maxDelay, customBackoff } =
      retryStrategy;

    if (customBackoff) {
      return customBackoff(attemptsMade);
    }

    let retryDelay: number;
    if (backoffType === "exponential") {
      retryDelay = backoffDelay * Math.pow(2, attemptsMade);
    } else {
      retryDelay = backoffDelay;
    }

    // Cap at maxDelay if specified
    return maxDelay ? Math.min(retryDelay, maxDelay) : retryDelay;
  }

  private async notifyFailure(
    job: Bull.Job,
    error: Error,
    recoveryConfig: ErrorRecovery
  ) {
    const notificationUsers = (recoveryConfig.metadata.notification?.users ||
      []) as string[];
    const notificationMessage =
      recoveryConfig.metadata.notification?.message || "Job failed";
    const notificationAction =
      recoveryConfig.metadata.notification?.action || "review";

    // Create notification record
    await prisma.notification.create({
      data: {
        type: "error_recovery",
        title: `Job ${job.id} Failed`,
        message: `${notificationMessage}\nError: ${error.message}`,
        metadata: {
          jobId: job.id,
          queueName: job.queue.name,
          error: error.message,
          action: notificationAction,
        },
        users: {
          connect: notificationUsers.map((userId: string) => ({ id: userId })),
        },
      },
    });

    // Send alert
    await alertService.processAlert(
      "job_failure_notification",
      notificationMessage,
      "error",
      {
        jobId: job.id,
        queueName: job.queue.name,
        error: error.message,
        action: notificationAction,
      }
    );
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService();
