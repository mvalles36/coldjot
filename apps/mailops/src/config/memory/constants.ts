export const MEMORY_MONITOR_CONFIG = {
  TARGET_MEMORY_LIMIT: 512, // 512MB target limit
  WARNING_THRESHOLD_PERCENTAGE: 0.8, // 80%
  CRITICAL_THRESHOLD_PERCENTAGE: 0.9, // 90%
  CHECK_INTERVAL: 60000, // 1 minute
} as const;

export type MemoryMonitorConfig = typeof MEMORY_MONITOR_CONFIG;
