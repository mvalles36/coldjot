import { z } from "zod";
import dotenv from "dotenv";

// TODO: check if this is needed
dotenv.config();

const envSchema = z.object({
  LOG_LEVEL: z.string().optional().default("info"),
  NODE_ENV: z.string().optional().default("development"),
  NEXT_PUBLIC_MAILOPS_API_URL: z
    .string()
    .optional()
    .default("http://localhost:3001/api"),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
});

export const env = envSchema.parse(process.env);
