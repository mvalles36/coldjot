import { z } from "zod";
import dotenv from "dotenv";

// TODO: check if this is needed
dotenv.config();

const envSchema = z.object({
  REDIS_HOST: z.string().optional().default("localhost"),
  REDIS_PORT: z.string().optional().default("6379"),
  REDIS_PASSWORD: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  LOG_LEVEL: z.string().optional().default("info"),
  NODE_ENV: z.string().optional().default("development"),
  QUEUE_API_URL: z.string().optional().default("http://localhost:3001/api"),
});

export const env = envSchema.parse(process.env);
