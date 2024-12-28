import { z } from "zod";
import { config } from "dotenv";
import path from "path";

const APP_ENV = process.env.APP_ENV || "development";

// Load environment variables from env directory
config({ path: path.resolve(process.cwd(), "env/.env") });
config({ path: path.resolve(process.cwd(), `env/.env.${APP_ENV}`) });
config({ path: path.resolve(process.cwd(), "env/.env.local") });
config({ path: path.resolve(process.cwd(), `env/.env.${APP_ENV}.local`) });

// Schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "Database URL is required"),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.string().default("6379"),
  REDIS_PASSWORD: z.string().optional(),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().default(5),
  QUEUE_PREFIX: z.string().default("mailjot"),

  // Monitoring
  ALERT_EMAIL_TO: z.string().optional(),
  ALERT_SLACK_WEBHOOK: z.string().optional(),

  // Error Recovery
  MAX_RETRIES: z.coerce.number().default(3),
  RETRY_DELAY: z.coerce.number().default(60000),
  MAX_RETRY_DELAY: z.coerce.number().default(3600000),

  // General
  LOG_LEVEL: z.string().default("info"),
  LOG_SHOW_TIME: z.boolean().default(false),
  NODE_ENV: z.string().default("development"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:4000"),
});

// Parse and validate environment variables
const env = envSchema.parse(process.env);

export { env, APP_ENV };
