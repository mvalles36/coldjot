// Environment
export * from "./env";

// Redis
export * from "./redis/keys";

// Queue
export * from "./queue/options";

// Rate Limit
export * from "./rate-limit/constants";

// Business Hours
export * from "./business/hours";

// Monitor
export * from "./monitor/constants";
export * from "./monitor/alert";

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
export const DEMO_MODE = process.env.DEMO_MODE === "true" ? true : false;
