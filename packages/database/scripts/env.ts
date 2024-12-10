import { config } from "dotenv";
import { resolve } from "path";

// Get environment from NODE_ENV or APP_ENV, fallback to development
const ENV = process.env.NODE_ENV || process.env.APP_ENV || "development";

// Load environment files in order of precedence
const envFiles = [
  ".env", // Base defaults
  `.env.${ENV}`, // Environment-specific defaults
  ".env.local", // Local overrides (git-ignored)
  `.env.${ENV}.local`, // Environment-specific local overrides (git-ignored)
].map((file) => resolve(__dirname, "../env", file));

// Load each env file
envFiles.forEach((file) => {
  const result = config({ path: file });
  if (result.parsed) {
    console.log(`Loaded environment variables from ${file}`);
  }
});

// Required environment variables
const requiredEnvVars = ["DATABASE_URL"];

// Validate required environment variables
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

// For development, set up shadow database URL if not provided
if (
  ENV === "development" &&
  !process.env.SHADOW_DATABASE_URL &&
  process.env.DATABASE_URL
) {
  const dbUrl = new URL(process.env.DATABASE_URL);
  const dbName = dbUrl.pathname.slice(1); // Remove leading slash
  dbUrl.pathname = `/shadow_${dbName}`;
  process.env.SHADOW_DATABASE_URL = dbUrl.toString();
  console.log("Set up shadow database URL:", process.env.SHADOW_DATABASE_URL);
}

// Create a shell-compatible export string
const exportString = Object.entries(process.env)
  .filter(
    ([key]) => requiredEnvVars.includes(key) || key === "SHADOW_DATABASE_URL"
  )
  .map(([key, value]) => `export ${key}="${value}"`)
  .join("; ");

// Write the export string to stdout
process.stdout.write(exportString);
