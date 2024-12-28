export const CONTACT_PROCESSING_CONFIG = {
  CHECK_INTERVAL: 60000, // 1 minute
  BATCH_SIZE: 100,
} as const;

export type ContactProcessingConfig = typeof CONTACT_PROCESSING_CONFIG;
