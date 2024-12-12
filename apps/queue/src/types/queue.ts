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
} from "@mailjot/types";

// Job Types
export interface ProcessingJob {
  type: "sequence" | "step" | "contact";
  id: string;
  priority: number;
  data: {
    sequenceId: string;
    contactId?: string;
    stepId?: string;
    userId: string;
    scheduleType: "business" | "custom";
    businessHours?: BusinessHours;
    testMode?: boolean;
  };
}

export interface EmailJob {
  type: "send" | "retry" | "bounce_check";
  id: string;
  priority: number;
  data: {
    sequenceId: string;
    contactId: string;
    stepId: string;
    userId: string;
    messageId?: string;
    emailOptions: SendEmailOptions;
    tracking: EmailTracking;
    account: GoogleAccount;
  };
}

// Email Types
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  threadId?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
}

// export interface EmailTracking {
//   enabled: boolean;
//   openTracking: boolean;
//   clickTracking: boolean;
//   unsubscribeTracking: boolean;
// }

// export interface GoogleAccount {
//   email: string;
//   accessToken: string;
//   refreshToken: string;
//   expiryDate: number;
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

export interface SequenceHealth {
  sequenceId: string;
  status: "healthy" | "warning" | "error" | "critical";
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

// Error Recovery Types
export interface ErrorRecovery {
  jobId: string;
  error: string;
  retryCount: number;
  lastRetry: Date;
  nextRetry?: Date;
  strategy: RetryStrategy;
  status: "pending" | "retrying" | "failed" | "recovered";
  metadata: Record<string, any>;
}

export interface RetryStrategy {
  maxRetries: number;
  backoffType: "fixed" | "exponential" | "custom";
  backoffDelay: number; // in milliseconds
  maxDelay?: number; // maximum delay for exponential backoff
  customBackoff?: (attempt: number) => number;
  shouldRetry?: (error: Error) => boolean;
}

// Re-export types from @mailjot/types for convenience
export { StepType };
export type { StepTiming, StepPriority, BusinessHours };
