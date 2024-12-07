import Bull from "bull";
import { env } from "@/env";

const queueConfig = {
  redis: {
    host: env.REDIS_HOST || "localhost",
    port: parseInt(env.REDIS_PORT || "6379"),
    password: env.REDIS_PASSWORD,
  },
  prefix: "mailjot",
};

// Queue names
export const QUEUE_NAMES = {
  SEQUENCE: "sequence-processing",
  EMAIL: "email-sending",
} as const;

// Create queues
export const sequenceQueue = new Bull(QUEUE_NAMES.SEQUENCE, queueConfig);
export const emailQueue = new Bull(QUEUE_NAMES.EMAIL, queueConfig);

// Helper functions for adding jobs
export async function addSequenceJob(data: {
  sequenceId: string;
  userId: string;
  priority?: number;
}) {
  return sequenceQueue.add(data, {
    priority: data.priority,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
}

export async function addEmailJob(data: {
  sequenceId: string;
  stepId: string;
  contactId: string;
  userId: string;
  priority?: number;
}) {
  return emailQueue.add(data, {
    priority: data.priority,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
}

// Cleanup on app shutdown
process.on("SIGTERM", async () => {
  await Promise.all([sequenceQueue.close(), emailQueue.close()]);
});
