import { QueueOptions, WorkerOptions } from "bullmq";
import { QUEUE_NAMES } from "./queue";

export interface ProcessorConfig {
  worker: WorkerOptions;
  rateLimits: {
    maxPerSecond: number;
    maxPerMinute: number;
  };
  queueOptions: {
    removeOnComplete: {
      count: number;
      age: number; // in seconds
    };
    removeOnFail: {
      count: number;
      age: number; // in seconds
    };
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
    queueOptions: {
      removeOnComplete: {
        count: 1000, // Keep last 1000 completed jobs
        age: 24 * 60 * 60, // Remove after 24 hours
      },
      removeOnFail: {
        count: 5000, // Keep last 5000 failed jobs
        age: 7 * 24 * 60 * 60, // Remove after 7 days
      },
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
    queueOptions: {
      removeOnComplete: {
        count: 1000,
        age: 24 * 60 * 60,
      },
      removeOnFail: {
        count: 5000,
        age: 7 * 24 * 60 * 60,
      },
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
    queueOptions: {
      removeOnComplete: {
        count: 1000,
        age: 24 * 60 * 60,
      },
      removeOnFail: {
        count: 5000,
        age: 7 * 24 * 60 * 60,
      },
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
    queueOptions: {
      removeOnComplete: {
        count: 1000,
        age: 24 * 60 * 60,
      },
      removeOnFail: {
        count: 5000,
        age: 7 * 24 * 60 * 60,
      },
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
    queueOptions: {
      removeOnComplete: {
        count: 1000,
        age: 24 * 60 * 60,
      },
      removeOnFail: {
        count: 5000,
        age: 7 * 24 * 60 * 60,
      },
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

/**
 * Get queue options for a processor
 */
export function getQueueOptions(processorName: keyof typeof PROCESSOR_CONFIG) {
  return PROCESSOR_CONFIG[processorName].queueOptions;
}
