const PREFIX = "mailjot:";

// TODO: Move to shared package
export const REDIS_KEYS = {
  // Rate limiting keys - In use
  rateLimits: {
    user: (userId: string) => `${PREFIX}rate:user:${userId}`,
    sequence: (userId: string, sequenceId: string) =>
      `${PREFIX}rate:sequence:${userId}:${sequenceId}`,
    contact: (userId: string, sequenceId: string, contactId: string) =>
      `${PREFIX}rate:contact:${userId}:${sequenceId}:${contactId}`,
    cooldown: (userId: string, sequenceId: string, contactId: string) =>
      `${PREFIX}rate:cooldown:${userId}:${sequenceId}:${contactId}`,
  },

  // Memory monitoring keys - In use
  memory: {
    metrics: () => `${PREFIX}memory:metrics`,
    alerts: () => `${PREFIX}memory:alerts`,
    config: () => `${PREFIX}memory:config`,
  },

  // Queue keys
  queue: {
    job: (queueName: string, jobId: string) =>
      `${PREFIX}queue:${queueName}:job:${jobId}`,
    status: (queueName: string) => `${PREFIX}queue:${queueName}:status`,
    metrics: (queueName: string) => `${PREFIX}queue:${queueName}:metrics`,
    progress: (queueName: string, jobId: string) =>
      `${PREFIX}queue:${queueName}:job:${jobId}:progress`,
  },

  // Sequence keys
  sequence: {
    progress: (sequenceId: string, contactId: string) =>
      `${PREFIX}sequence:${sequenceId}:contact:${contactId}:progress`,
    status: (sequenceId: string) => `${PREFIX}sequence:${sequenceId}:status`,
    metrics: (sequenceId: string) => `${PREFIX}sequence:${sequenceId}:metrics`,
  },

  // Contact keys
  contact: {
    sequence: (contactId: string) => `${PREFIX}contact:${contactId}:sequence`,
    status: (contactId: string) => `${PREFIX}contact:${contactId}:status`,
    metrics: (contactId: string) => `${PREFIX}contact:${contactId}:metrics`,
  },

  // Email keys
  email: {
    thread: (emailId: string) => `${PREFIX}email:${emailId}:thread`,
    status: (emailId: string) => `${PREFIX}email:${emailId}:status`,
    metrics: (emailId: string) => `${PREFIX}email:${emailId}:metrics`,
  },
} as const;
