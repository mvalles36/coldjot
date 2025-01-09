// Redis key prefix configuration
export const REDIS_PREFIX = "coldjot:" as const;
export const QUEUE_PREFIX = REDIS_PREFIX;

// Rate limit types for better type safety
export const RATE_LIMIT_TYPES = {
  USER: "user",
  SEQUENCE: "sequence",
  CONTACT: "contact",
  COOLDOWN: "cooldown",
} as const;

// TODO: Move to shared package
export const REDIS_KEYS = {
  // Rate limiting keys - In use
  rateLimits: {
    // Flattened key structure with type prefixes for better scanning and grouping
    // Format: coldjot:ratelimit:{type}:{userId}[:{entityId}]
    user: (userId: string) =>
      `${REDIS_PREFIX}ratelimit:${RATE_LIMIT_TYPES.USER}:${userId}`,
    sequence: (userId: string, sequenceId: string) =>
      `${REDIS_PREFIX}ratelimit:${RATE_LIMIT_TYPES.SEQUENCE}:${userId}:${sequenceId}`,
    contact: (userId: string, sequenceId: string, contactId: string) =>
      `${REDIS_PREFIX}ratelimit:${RATE_LIMIT_TYPES.CONTACT}:${userId}:${contactId}`,
    cooldown: (userId: string, sequenceId: string, contactId: string) =>
      `${REDIS_PREFIX}ratelimit:${RATE_LIMIT_TYPES.COOLDOWN}:${userId}:${contactId}`,
  },

  // Memory monitoring keys - In use
  memory: {
    metrics: () => `${REDIS_PREFIX}memory:metrics`,
    alerts: () => `${REDIS_PREFIX}memory:alerts`,
    config: () => `${REDIS_PREFIX}memory:config`,
  },

  // Queue keys
  queue: {
    job: (queueName: string, jobId: string) =>
      `${QUEUE_PREFIX}${queueName}:job:${jobId}`,
    status: (queueName: string) => `${QUEUE_PREFIX}${queueName}:status`,
    metrics: (queueName: string) => `${QUEUE_PREFIX}${queueName}:metrics`,
    progress: (queueName: string, jobId: string) =>
      `${QUEUE_PREFIX}${queueName}:job:${jobId}:progress`,
  },

  // Sequence keys
  sequence: {
    progress: (sequenceId: string, contactId: string) =>
      `${REDIS_PREFIX}sequence:${sequenceId}:contact:${contactId}:progress`,
    status: (sequenceId: string) =>
      `${REDIS_PREFIX}sequence:${sequenceId}:status`,
    metrics: (sequenceId: string) =>
      `${REDIS_PREFIX}sequence:${sequenceId}:metrics`,
  },

  // Contact keys
  contact: {
    sequence: (contactId: string) =>
      `${REDIS_PREFIX}contact:${contactId}:sequence`,
    status: (contactId: string) => `${REDIS_PREFIX}contact:${contactId}:status`,
    metrics: (contactId: string) =>
      `${REDIS_PREFIX}contact:${contactId}:metrics`,
  },

  // Email keys
  email: {
    thread: (emailId: string) => `${REDIS_PREFIX}email:${emailId}:thread`,
    status: (emailId: string) => `${REDIS_PREFIX}email:${emailId}:status`,
    metrics: (emailId: string) => `${REDIS_PREFIX}email:${emailId}:metrics`,
  },
} as const;

// Export types for better type safety
export type RateLimitType = keyof typeof RATE_LIMIT_TYPES;
