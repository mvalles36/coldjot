export const QUEUE_CONFIG = {
  DEFAULT_JOB_OPTIONS: {
    // TODO: Add settings based on environment. It will hog memory if not set.
    removeOnComplete: {
      //   age: 24 * 3600, // 24 hours
      count: 1,
    },
    removeOnFail: {
      //   age: 24 * 3600,
      count: 1,
    },
  },
  RETRY_OPTIONS: {
    SEQUENCE: {
      attempts: 3,
      backoff: {
        type: "exponential" as const,
        delay: 1000,
      },
    },
    EMAIL: {
      attempts: 2,
      backoff: {
        type: "exponential" as const,
        delay: 1000,
      },
    },
    THREAD: {
      attempts: 3,
      backoff: {
        type: "exponential" as const,
        delay: 1000,
      },
    },
  },
} as const;

export const QUEUE_NAMES = {
  SEQUENCE: "sequence-processing",
  EMAIL: "email-sending",
} as const;

export const JOB_PRIORITIES = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const;

export const JOB_ATTEMPTS = {
  SEQUENCE: 3,
  EMAIL: 2,
} as const;

export const RETRY_DELAYS = {
  SEQUENCE: 1000, // 1 second
  EMAIL: 1000, // 1 second
} as const;

export const CLEANUP_AGE = 24 * 60 * 60 * 1000; // 24 hours

export type QueueConfig = typeof QUEUE_CONFIG;
export type QueueNames = typeof QUEUE_NAMES;
export type JobPriorities = typeof JOB_PRIORITIES;
export type JobAttempts = typeof JOB_ATTEMPTS;
export type RetryDelays = typeof RETRY_DELAYS;
