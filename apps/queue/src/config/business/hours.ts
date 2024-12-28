import type { BusinessHours } from "@mailjot/types";

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  timezone: "UTC",
  workDays: [1, 2, 3, 4, 5], // Monday to Friday
  workHoursStart: "09:00",
  workHoursEnd: "17:00",
  holidays: [],
} as const;

// Development mode flag
export const isDevelopment =
  process.env.NODE_ENV === "development" ? true : false;

// Demo mode flag - will bypass business hours checks
export const DEMO_MODE = process.env.DEMO_MODE === "true" ? true : false;
