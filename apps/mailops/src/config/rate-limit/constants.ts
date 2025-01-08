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
  SCHEDULING: {
    MIN_DELAY: 1, // Minimum delay in minutes
    DEFAULT_DELAY: 30, // Default delay in minutes
    DISTRIBUTION_WINDOW: 15, // Minutes to distribute load within
    MAX_EMAILS_PER_MINUTE: 50, // Maximum emails per minute
    MAX_EMAILS_PER_HOUR: 1000, // Maximum emails per hour
  },
} as const;

export type RateLimitConfig = typeof RATE_LIMIT_CONFIG;
