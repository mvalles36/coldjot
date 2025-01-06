import { AlertConfig } from "@coldjot/types";

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  errorThreshold: 0.1, // 10% error rate
  warningThreshold: 0.05, // 5% error rate
  criticalThreshold: 0.2, // 20% error rate
  checkInterval: 5 * 60 * 1000, // 5 minutes
  retryInterval: 60 * 1000, // 1 minute
  maxRetries: 3,
  channels: {
    email: [process.env.ALERT_EMAIL_TO || ""],
  },
} as const;

export type AlertConfigType = typeof DEFAULT_ALERT_CONFIG;
