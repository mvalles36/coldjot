import { config } from "dotenv";
import path from "path";

// Load environment variables based on APP_ENV
const APP_ENV = process.env.APP_ENV || "development";

// Load environment variables from env directory in order of precedence
const envFiles = [
  "env/.env", // 1. Base defaults
  `env/.env.${APP_ENV}`, // 2. Environment-specific defaults
  "env/.env.local", // 3. Local overrides
  `env/.env.${APP_ENV}.local`, // 4. Local environment-specific overrides
];

// Load each env file if it exists
envFiles.forEach((file) => {
  config({ path: path.resolve(process.cwd(), file) });
});

// Validate required environment variables
const requiredEnvVars = ["DATABASE_URL"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}
