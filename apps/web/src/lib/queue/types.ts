import type { BusinessHours, SendEmailOptions, EmailTracking } from "@/types";
import type { JOB_TYPES, JOB_PRIORITIES } from "./queue-config";
import type Bull from "bull";

// Utility types
type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];
type JobPriority = (typeof JOB_PRIORITIES)[keyof typeof JOB_PRIORITIES];

// Custom RepeatOptions type that extends Bull's RepeatOptions
interface CustomRepeatOptions extends Omit<Bull.RepeatOptions, "every"> {
  every: number;
}

// Base job interface
interface BaseJob {
  id: string;
  priority: JobPriority;
  timestamp: Date;
  userId: string;
  repeat?: CustomRepeatOptions;
}

// Processing jobs
export interface ProcessingJob extends BaseJob {
  type: "sequence" | "step" | "contact";
  data: {
    sequenceId: string;
    contactId?: string;
    stepId?: string;
    scheduleType: "business" | "custom";
    businessHours?: BusinessHours;
  };
}

// Email jobs
export interface EmailJob extends BaseJob {
  type: "send" | "retry" | "bounce_check";
  data: {
    sequenceId: string;
    contactId: string;
    stepId: string;
    emailOptions: SendEmailOptions;
    tracking: EmailTracking;
    account: {
      access_token: string;
      refresh_token: string;
      providerAccountId: string;
    };
    messageId?: string;
  };
}

// Monitoring jobs
export interface MonitoringJob extends BaseJob {
  type: "health_check" | "metrics" | "rate_limit";
  data: {
    scope: "sequence" | "system" | "user";
    targetId?: string;
    metrics?: string[];
  };
}

// Cleanup jobs
export interface CleanupJob extends BaseJob {
  type: "cleanup";
  data: {
    target: "jobs" | "metrics" | "events";
    olderThan: Date;
    status?: "completed" | "failed";
  };
}

// Job results
export interface JobResult {
  success: boolean;
  error?: Error;
  data?: any;
  nextJob?: {
    type: JobType;
    data: any;
    options?: {
      priority?: JobPriority;
      delay?: number;
    };
  };
}

// Queue metrics
export interface QueueMetrics {
  name: string;
  size: number;
  processed: number;
  failed: number;
  delayed: number;
  active: number;
  waiting: number;
  paused: boolean;
  errorRate: number;
  processingTime: number;
}

// Rate limit tracking
export interface RateLimitInfo {
  userId: string;
  sequenceId?: string;
  contactId?: string;
  counts: {
    minute: number;
    hour: number;
    day: number;
  };
  lastReset: {
    minute: Date;
    hour: Date;
    day: Date;
  };
  cooldowns: {
    type: "bounce" | "error";
    until: Date;
  }[];
}
