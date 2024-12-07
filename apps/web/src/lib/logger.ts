import pino from "pino";

interface CustomLogger extends pino.Logger {
  startOperation: (operation: string, metadata?: Record<string, any>) => void;
  endOperation: (operation: string, metadata?: Record<string, any>) => void;
  failOperation: (
    operation: string,
    error: Error,
    metadata?: Record<string, any>
  ) => void;
}

// Configure logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      translateTime: "SYS:standard",
    },
  },
  base: {
    env: process.env.NODE_ENV,
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  redact: {
    paths: [
      "email",
      "password",
      "access_token",
      "refresh_token",
      "*.password",
      "*.token",
      "*.key",
    ],
    remove: true,
  },
}) as CustomLogger;

// Add custom methods
logger.startOperation = (operation: string, metadata = {}) => {
  logger.info(
    { event: "start", operation, ...metadata },
    `Starting ${operation}`
  );
};

logger.endOperation = (operation: string, metadata = {}) => {
  logger.info(
    { event: "end", operation, ...metadata },
    `Completed ${operation}`
  );
};

logger.failOperation = (operation: string, error: Error, metadata = {}) => {
  logger.error(
    {
      event: "error",
      operation,
      error: error.message,
      stack: error.stack,
      ...metadata,
    },
    `Failed ${operation}`
  );
};

// Export the enhanced logger
export { logger };
