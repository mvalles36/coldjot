export const REDIS_PREFIX = "mailjot";

export const REDIS_KEYS = {
  QUEUES: {
    SEQUENCE: "sequence",
    EMAIL: "email",
    THREAD: "thread",
  },
  RATE_LIMIT: {
    PREFIX: `${REDIS_PREFIX}:rate-limit`,
    COOLDOWN: `${REDIS_PREFIX}:cooldown`,
  },
  MONITORS: {
    MEMORY: `${REDIS_PREFIX}:monitor:memory`,
    THREAD: `${REDIS_PREFIX}:monitor:thread`,
  },
};

export const QUEUE_CONFIG = {
  DEFAULT_JOB_OPTIONS: {
    removeOnComplete: {
      age: 24 * 3600, // 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 24 * 3600,
      count: 1000,
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
};

export const RATE_LIMIT_CONFIG = {
  DEFAULT_LIMIT: 100,
  COOLDOWN_TYPES: {
    ERROR: "error",
    BOUNCE: "bounce",
  },
};

export const MONITOR_CONFIG = {
  MEMORY: {
    CHECK_INTERVAL: 30000, // 30 seconds
  },
  THREAD: {
    // Environment-specific check frequencies
    CHECK_FREQUENCIES: {
      DEVELOPMENT: {
        RECENT: { minutes: 1 }, // Check every 5 minutes for recent threads
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
        RECENT: { hours: 1 }, // Check every hour for recent threads
        MEDIUM: { days: 1 }, // Check daily for medium-age threads
        OLD: { days: 7 }, // Check weekly for old threads
        VERY_OLD: { days: 30 }, // Check monthly for very old threads
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
        RECENT: { days: 7 }, // Threads less than 7 days old
        MEDIUM: { days: 30 }, // Threads less than 30 days old
        OLD: { days: 90 }, // Threads less than 90 days old
      },
    },
  },
};
