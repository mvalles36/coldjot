export const MONITOR_CONFIG = {
  MEMORY: {
    CHECK_INTERVAL: 30000, // 30 seconds
  },
  THREAD: {
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
} as const;

export type MonitorConfig = typeof MONITOR_CONFIG;
