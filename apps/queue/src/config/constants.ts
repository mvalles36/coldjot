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
    CHECK_FREQUENCIES: {
      RECENT: { hours: 1 },
      MEDIUM: { days: 1 },
      OLD: { days: 7 },
      VERY_OLD: { days: 30 },
    },
    AGE_THRESHOLDS: {
      RECENT: { days: 7 },
      MEDIUM: { days: 30 },
      OLD: { days: 90 },
    },
  },
};
