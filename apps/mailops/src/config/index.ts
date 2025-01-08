// Environment
export * from "./env";

// Redis
export * from "./redis/keys";

// Queue
export * from "./queue/index";

// Rate Limit
export * from "./rate-limit/constants";

// Business Hours
export * from "./business/constants";

// Monitor
export * from "./monitor/constants";

// Contact Processing
export * from "./contact/constants";

// Memory Monitor
export * from "./memory/constants";

// Email Scheduling
export * from "./schedule/email";

// Development mode flag
export const isDevelopment =
  process.env.NODE_ENV === "development" ? true : false;

// Demo mode flag - will bypass business hours checks
export const DEMO_MODE = process.env.DEMO_MODE === "true" ? true : true;

export const env = {
  LOG_PATH_DEPTH: process.env.LOG_PATH_DEPTH,
  LOG_SHOW_TIME: process.env.LOG_SHOW_TIME,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_TO_FILE: process.env.LOG_TO_FILE === "true" ? true : true,
  LOG_DIR: process.env.LOG_DIR || "logs",
  APP_ENV: process.env.APP_ENV || "development",
} as const;
