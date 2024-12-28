export const RATE_LIMIT_CONFIG = {
  DEFAULT_LIMIT: 100,
  COOLDOWN_TYPES: {
    ERROR: "error",
    BOUNCE: "bounce",
  },
  DEFAULT_LIMITS: {
    perMinute: 60,
    perHour: 500,
    perDay: 2000,
    perContact: 3,
    perSequence: 1000,
    cooldown: {
      afterBounce: 24 * 60 * 60 * 1000, // 24 hours
      afterError: 15 * 60 * 1000, // 15 minutes
    },
  },
} as const;

export type RateLimitConfig = typeof RATE_LIMIT_CONFIG;
