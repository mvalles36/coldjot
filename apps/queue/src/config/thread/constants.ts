export const THREAD_CONFIG = {
  // Processing configuration
  BATCH: {
    MIN_SIZE: 50,
    MAX_SIZE: 500,
    CONCURRENCY: 10,
    RATE_LIMIT: {
      MAX_PER_SECOND: 50,
      MAX_PER_MINUTE: 1000,
    },
  },
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF: {
      MIN_DELAY: 1000, // 1 second
      MAX_DELAY: 300000, // 5 minutes
      FACTOR: 2, // Exponential backoff factor
    },
  },
  // Environment-specific check frequencies
  CHECK_FREQUENCIES: {
    DEVELOPMENT: {
      RECENT: { minutes: 1 }, // Check every minute for recent threads
      MEDIUM: { minutes: 15 }, // Check every 15 minutes for medium-age threads
      OLD: { minutes: 30 }, // Check every 30 minutes for old threads
      VERY_OLD: { hours: 1 }, // Check every hour for very old threads
    },
    DEMO: {
      RECENT: { minutes: 1 }, // Check every minute for recent threads
      MEDIUM: { minutes: 2 }, // Check every 2 minutes for medium-age threads
      OLD: { minutes: 5 }, // Check every 5 minutes for old threads
      VERY_OLD: { minutes: 10 }, // Check every 10 minutes for very old threads
    },
    PRODUCTION: {
      RECENT: { hours: 2 }, // Check every 2 hours for recent threads
      MEDIUM: { hours: 6 }, // Check every 6 hours for medium-age threads
      OLD: { days: 2 }, // Check every 2 days for old threads
      VERY_OLD: { days: 7 }, // Check weekly for very old threads
    },
  },
  // Environment-specific age thresholds
  AGE_THRESHOLDS: {
    DEVELOPMENT: {
      RECENT: { hours: 1 }, // Threads less than 1 hour old
      MEDIUM: { hours: 4 }, // Threads less than 4 hours old
      OLD: { hours: 24 }, // Threads less than 24 hours old
    },
    DEMO: {
      RECENT: { minutes: 2 }, // Threads less than 2 minutes old
      MEDIUM: { minutes: 5 }, // Threads less than 5 minutes old
      OLD: { minutes: 15 }, // Threads less than 15 minutes old
    },
    PRODUCTION: {
      RECENT: { days: 3 }, // Threads less than 3 days old
      MEDIUM: { days: 14 }, // Threads less than 14 days old
      OLD: { days: 30 }, // Threads less than 30 days old
    },
  },
  // Priority levels for different thread states
  PRIORITY: {
    RECENT_HIGH_ENGAGEMENT: 1,
    RECENT_NO_RESPONSE: 2,
    MEDIUM_AGE: 3,
    OLD_AGE: 4,
    VERY_OLD: 5,
  },
} as const;

export type ThreadConfig = typeof THREAD_CONFIG;
