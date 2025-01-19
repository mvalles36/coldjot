import {
  BusinessHours,
  SequenceStep,
  StepType,
  StepTiming,
  StepPriority,
  ProcessingWindow,
  RateLimits,
  EmailTracking,
  GoogleAccount,
  ProcessingJob,
  EmailJob,
} from "@coldjot/types";

// Email Types
// export interface EmailResult {
//   success: boolean;
//   messageId?: string;
//   threadId?: string;
//   error?: string;
// }

// Monitoring Types
export interface AlertConfig {
  errorThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  checkInterval: number;
  retryInterval: number;
  maxRetries: number;
  channels: {
    email?: string[];
    slack?: string[];
    webhook?: string[];
  };
}

export interface AlertThresholds {
  error: number;
  warning: number;
  critical: number;
  bounce?: number;
  delivery?: number;
}

export enum SequenceHealthStatusEnum {
  HEALTHY = "healthy",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export type SequenceHealthStatusType = SequenceHealthStatusEnum;

export interface SequenceHealth {
  sequenceId: string;
  status: SequenceHealthStatusType;
  errorCount: number;
  lastCheck: Date;
  lastError?: string;
  metrics: {
    deliveryRate: number;
    bounceRate: number;
    errorRate: number;
    processingTime: number;
  };
}

export interface SystemMetrics {
  queueSize: number;
  processingRate: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeWorkers: number;
  jobsCompleted: number;
  jobsFailed: number;
}

// Processing Types
export interface ProcessingResult {
  success: boolean;
  error?: string;
  retryable?: boolean;
  nextRun?: Date;
  data?: any;
}

export interface ProcessingContext {
  job: ProcessingJob | EmailJob;
  attempt: number;
  startTime: Date;
  businessHours?: BusinessHours;
  rateLimits?: RateLimits;
  window?: ProcessingWindow;
}

export interface JobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface QueueMetrics {
  processingRate: number;
  errorRate: number;
  avgProcessingTime: number;
  throughput: number;
}

export enum ErrorRecoveryStatusEnum {
  PENDING = "pending",
  RETRYING = "retrying",
  FAILED = "failed",
  RECOVERED = "recovered",
}

export type ErrorRecoveryStatusType = ErrorRecoveryStatusEnum;

// Error Recovery Types
export interface ErrorRecovery {
  jobId: string;
  error: string;
  retryCount: number;
  lastRetry: Date;
  nextRetry?: Date;
  strategy: RetryStrategy;
  status: ErrorRecoveryStatusType;
  metadata: Record<string, any>;
}

export enum RetryStrategyBackoffEnum {
  FIXED = "fixed",
  EXPONENTIAL = "exponential",
  CUSTOM = "custom",
}

export type RetryStrategyBackoffType = RetryStrategyBackoffEnum;

export interface RetryStrategy {
  maxRetries: number;
  backoffType: RetryStrategyBackoffType;
  backoffDelay: number; // in milliseconds
  maxDelay?: number; // maximum delay for exponential backoff
  customBackoff?: (attempt: number) => number;
  shouldRetry?: (error: Error) => boolean;
}

// Re-export types from @coldjot/types for convenience
// export { StepType };
export type { StepTiming, StepPriority, BusinessHours };
