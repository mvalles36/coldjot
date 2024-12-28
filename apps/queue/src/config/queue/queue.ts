import { QueueOptions } from "bullmq";

// Queue names with their actual queue identifiers
export const QUEUE_NAMES = {
  EMAIL: "email-sending",
  SEQUENCE: "sequence-processing",
  THREAD_WATCHER: "thread-watcher",
  CONTACT: "contact-processing",
  EMAIL_SCHEDULE: "email-schedule",
} as const;

export type QueueName = keyof typeof QUEUE_NAMES;

// Queue processor paths mapping
export const QUEUE_PATHS = {
  EMAIL: "email",
  SEQUENCE: "sequence",
  THREAD_WATCHER: "thread", // Note: processor is in thread folder
  CONTACT: "contact",
  EMAIL_SCHEDULE: "schedule", // Note: processor is in schedule folder
} as const;

// Job priorities for all queues
export const JOB_PRIORITIES = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const;

export type JobPriority = (typeof JOB_PRIORITIES)[keyof typeof JOB_PRIORITIES];

// Job attempts per queue type
export const JOB_ATTEMPTS = {
  SEQUENCE: 3,
  EMAIL: 2,
  THREAD: 3,
  CONTACT: 3,
  EMAIL_SCHEDULE: 2,
} as const;

// Retry delays in milliseconds
export const RETRY_DELAYS = {
  SEQUENCE: 1000, // 1 second
  EMAIL: 1000, // 1 second
  THREAD: 1000, // 1 second
  CONTACT: 1000, // 1 second
  EMAIL_SCHEDULE: 1000, // 1 second
} as const;

// Retry configurations with backoff strategies
export const RETRY_OPTIONS = {
  SEQUENCE: {
    attempts: JOB_ATTEMPTS.SEQUENCE,
    backoff: {
      type: "exponential" as const,
      delay: RETRY_DELAYS.SEQUENCE,
    },
  },
  EMAIL: {
    attempts: JOB_ATTEMPTS.EMAIL,
    backoff: {
      type: "exponential" as const,
      delay: RETRY_DELAYS.EMAIL,
    },
  },
  THREAD: {
    attempts: JOB_ATTEMPTS.THREAD,
    backoff: {
      type: "exponential" as const,
      delay: RETRY_DELAYS.THREAD,
    },
  },
  CONTACT: {
    attempts: JOB_ATTEMPTS.CONTACT,
    backoff: {
      type: "exponential" as const,
      delay: RETRY_DELAYS.CONTACT,
    },
  },
  EMAIL_SCHEDULE: {
    attempts: JOB_ATTEMPTS.EMAIL_SCHEDULE,
    backoff: {
      type: "exponential" as const,
      delay: RETRY_DELAYS.EMAIL_SCHEDULE,
    },
  },
} as const;

// Cleanup settings
export const CLEANUP_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Omit connection from QueueOptions as it will be provided by the service manager
export type QueueConfig = Omit<QueueOptions, "connection">;

// Default queue options with cleanup settings
export const DEFAULT_QUEUE_OPTIONS: QueueConfig = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: CLEANUP_AGE,
      count: 1, // Keep minimal completed jobs in memory
    },
    removeOnFail: {
      age: CLEANUP_AGE,
      count: 1, // Keep minimal failed jobs in memory
    },
  },
};

// Queue-specific options that override defaults
export const QUEUE_OPTIONS: Partial<Record<QueueName, QueueConfig>> = {
  EMAIL: {
    defaultJobOptions: {
      ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
      ...RETRY_OPTIONS.EMAIL,
    },
  },
  SEQUENCE: {
    defaultJobOptions: {
      ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
      ...RETRY_OPTIONS.SEQUENCE,
    },
  },
  THREAD_WATCHER: {
    defaultJobOptions: {
      ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
      ...RETRY_OPTIONS.THREAD,
      backoff: {
        type: "fixed",
        delay: 5000, // 5 seconds delay between retries
      },
    },
  },
  CONTACT: {
    defaultJobOptions: {
      ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
      ...RETRY_OPTIONS.CONTACT,
    },
  },
  EMAIL_SCHEDULE: {
    defaultJobOptions: {
      ...DEFAULT_QUEUE_OPTIONS.defaultJobOptions,
      ...RETRY_OPTIONS.EMAIL_SCHEDULE,
    },
  },
};

// Processor concurrency settings
export const PROCESSOR_CONCURRENCY = {
  EMAIL: 5,
  SEQUENCE: 3,
  THREAD_WATCHER: 2,
  CONTACT: 5,
  EMAIL_SCHEDULE: 3,
} as const;

// Export types for type safety
export type JobAttempts = typeof JOB_ATTEMPTS;
export type RetryDelays = typeof RETRY_DELAYS;
export type ProcessorConcurrency = typeof PROCESSOR_CONCURRENCY;
