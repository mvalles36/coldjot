export const EMAIL_SCHEDULER_CONFIG = {
  CHECK_INTERVAL: 60000, // 1 minute
  RETRY_DELAY: 300000, // 5 minutes
  DEVELOPMENT_MODE: process.env.APP_ENV === "development",
} as const;

export type EmailSchedulerConfig = typeof EMAIL_SCHEDULER_CONFIG;
