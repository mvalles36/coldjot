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
