import Bull from "bull";
import { env } from "@/env";

export const queueConfig: Bull.QueueOptions = {
  redis: {
    host: env.REDIS_HOST || "localhost",
    port: parseInt(env.REDIS_PORT || "6379"),
    password: env.REDIS_PASSWORD,
  },
  prefix: "mailjot",
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
};

// Queue names
export const QUEUE_NAMES = {
  PROCESSING: "sequence-processing",
  SCHEDULING: "sequence-scheduling",
  SENDING: "sequence-sending",
  MONITORING: "sequence-monitoring",
  CLEANUP: "sequence-cleanup",
} as const;

// Job types
export const JOB_TYPES = {
  // Processing jobs
  PROCESS_SEQUENCE: "process-sequence",
  PROCESS_STEP: "process-step",
  PROCESS_CONTACT: "process-contact",

  // Email jobs
  SEND_EMAIL: "send-email",
  RETRY_EMAIL: "retry-email",
  CHECK_BOUNCE: "check-bounce",

  // Monitoring jobs
  HEALTH_CHECK: "health-check",
  COLLECT_METRICS: "collect-metrics",
  CHECK_RATE_LIMITS: "check-rate-limits",

  // Cleanup jobs
  CLEANUP_OLD_JOBS: "cleanup-old-jobs",
  CLEANUP_FAILED_JOBS: "cleanup-failed-jobs",
} as const;

// Job priorities
export const JOB_PRIORITIES = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
  BULK: 5,
} as const;

// Rate limits
export const RATE_LIMITS = {
  PER_MINUTE: 60,
  PER_HOUR: 500,
  PER_DAY: 2000,
  PER_CONTACT: 5,
  PER_SEQUENCE: 100,
  COOLDOWN: {
    AFTER_BOUNCE: 24 * 60 * 60 * 1000, // 24 hours
    AFTER_ERROR: 15 * 60 * 1000, // 15 minutes
  },
} as const;
