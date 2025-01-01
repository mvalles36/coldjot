import { QueueOptions, WorkerOptions } from "bullmq";
import { QUEUE_NAMES } from "./queue";

export interface ProcessorConfig {
  worker: WorkerOptions;
  rateLimits: {
    maxPerSecond: number;
    maxPerMinute: number;
  };
}

export const PROCESSOR_CONFIG = {
  [QUEUE_NAMES.EMAIL]: {
    worker: {
      concurrency: 10,
      limiter: {
        max: 50,
        duration: 1000,
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    },
    rateLimits: {
      maxPerSecond: 50,
      maxPerMinute: 500,
    },
  },
  [QUEUE_NAMES.SEQUENCE]: {
    worker: {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000,
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    },
    rateLimits: {
      maxPerSecond: 100,
      maxPerMinute: 1000,
    },
  },
  [QUEUE_NAMES.THREAD_WATCHER]: {
    worker: {
      concurrency: 10,
      limiter: {
        max: 50,
        duration: 1000,
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    },
    rateLimits: {
      maxPerSecond: 50,
      maxPerMinute: 1000,
    },
  },
  [QUEUE_NAMES.CONTACT]: {
    worker: {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000,
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    },
    rateLimits: {
      maxPerSecond: 100,
      maxPerMinute: 1000,
    },
  },
  [QUEUE_NAMES.EMAIL_SCHEDULE]: {
    worker: {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000,
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    },
    rateLimits: {
      maxPerSecond: 100,
      maxPerMinute: 1000,
    },
  },
} as const;

/**
 * Get BullMQ worker options for a processor
 */
export function getWorkerOptions(
  processorName: keyof typeof PROCESSOR_CONFIG
): WorkerOptions {
  return PROCESSOR_CONFIG[processorName].worker;
}

/**
 * Get rate limits for a processor
 */
export function getRateLimits(processorName: keyof typeof PROCESSOR_CONFIG) {
  return PROCESSOR_CONFIG[processorName].rateLimits;
}
