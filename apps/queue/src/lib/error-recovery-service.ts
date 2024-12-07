import { prisma } from "@mailjot/database";
import { ErrorRecovery, RetryStrategy } from "../types/queue";
import { logger } from "./logger";
import { alertService } from "./alert-service";
import Bull from "bull";

export class ErrorRecoveryService {
  private defaultRetryStrategy: RetryStrategy = {
    maxAttempts: 3,
    backoff: {
      type: "exponential",
      delay: 60 * 1000, // 1 minute
      maxDelay: 24 * 60 * 60 * 1000, // 24 hours
    },
    shouldRetry: (error: Error) => {
      // Don't retry on certain error types
      const nonRetryableErrors = [
        "InvalidCredentialsError",
        "RateLimitExceededError",
        "InvalidRecipientError",
      ];
      return !nonRetryableErrors.some((type) => error.name === type);
    },
    onFinalFailure: async (job: Bull.Job) => {
      await alertService.processAlert(
        "job_failure",
        `Job ${job.id} failed after ${job.attemptsMade} attempts`,
        "error",
        {
          queueName: job.queue.name,
          jobData: job.data,
          error: job.failedReason,
        }
      );
    },
  };

  private defaultErrorRecovery: ErrorRecovery = {
    type: "auto",
    strategy: "retry",
    notification: {
      users: [],
      message: "Automatic recovery attempt in progress",
      action: "review",
    },
  };

  async handleJobError(
    job: Bull.Job,
    error: Error,
    retryStrategy: RetryStrategy = this.defaultRetryStrategy,
    recoveryConfig: ErrorRecovery = this.defaultErrorRecovery
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
        job.attemptsMade < retryStrategy.maxAttempts &&
        retryStrategy.shouldRetry(error)
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
      attempts: retryStrategy.maxAttempts - job.attemptsMade,
      backoff: retryStrategy.backoff,
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
    // Execute final failure callback
    await retryStrategy.onFinalFailure(job);

    // Handle based on recovery config
    if (recoveryConfig.type === "auto") {
      switch (recoveryConfig.strategy) {
        case "skip":
          await job.moveToCompleted("Skipped after final failure", true);
          break;
        case "pause":
          await job.queue.pause();
          break;
        default:
          await job.moveToFailed(error, true);
      }
    }

    // Send notifications
    await this.notifyFailure(job, error, recoveryConfig);
  }

  private calculateRetryDelay(
    attemptsMade: number,
    retryStrategy: RetryStrategy
  ): number {
    const { type, delay, maxDelay } = retryStrategy.backoff;

    let retryDelay: number;
    if (type === "exponential") {
      retryDelay = delay * Math.pow(2, attemptsMade);
    } else {
      retryDelay = delay;
    }

    // Cap at maxDelay
    return Math.min(retryDelay, maxDelay);
  }

  private async notifyFailure(
    job: Bull.Job,
    error: Error,
    recoveryConfig: ErrorRecovery
  ) {
    const { users, message, action } = recoveryConfig.notification;

    // Create notification record
    await prisma.notification.create({
      data: {
        type: "error_recovery",
        title: `Job ${job.id} Failed`,
        message: `${message}\nError: ${error.message}`,
        metadata: {
          jobId: job.id,
          queueName: job.queue.name,
          error: error.message,
          action,
        },
        users: {
          connect: users.map((userId) => ({ id: userId })),
        },
      },
    });

    // Send alert
    await alertService.processAlert(
      "job_failure_notification",
      message,
      "error",
      {
        jobId: job.id,
        queueName: job.queue.name,
        error: error.message,
        action,
      }
    );
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService();
