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
} as const;

export type RedisKeys = typeof REDIS_KEYS;
