export const CONTACT_PROCESSING_CONFIG = {
  // TODO: Change to 1 minute
  CHECK_INTERVAL: 5000, // 5 seconds
  BATCH_SIZE: 100,
} as const;

export type ContactProcessingConfig = typeof CONTACT_PROCESSING_CONFIG;
