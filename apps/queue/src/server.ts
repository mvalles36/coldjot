import express from "express";
import cors from "cors";
import { logger } from "@/lib/log";
import pinoHttp from "pino-http";
import routes from "./routes";
import { ServiceInitializer } from "@/services/init/service-initializer";

const app = express();
const port = 3001;
const serviceInitializer = ServiceInitializer.getInstance();

// Initialize all services
serviceInitializer.initialize().catch((error) => {
  logger.error("Failed to initialize services:", error);
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json());

// Add request logging
const httpLogger = pinoHttp({
  logger,
  customLogLevel: function (req, res, error) {
    if (error) return "error";
    if (res.statusCode >= 400 && res.statusCode < 500) return "warn";
    if (res.statusCode >= 500) return "error";
    return "info";
  },
  customSuccessMessage: function (req, res) {
    return `request completed with status ${res.statusCode}`;
  },
  customErrorMessage: function (req, res, error) {
    return `request failed with status ${res.statusCode}: ${error.message}`;
  },
});

app.use(httpLogger);

// Mount all routes
app.use("/api", routes);

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error(err, "Unhandled error");
    res.status(500).json({ error: "Internal Server Error" });
  }
);

// Graceful shutdown handling
process.on("SIGTERM", async () => {
  await serviceInitializer.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await serviceInitializer.shutdown();
  process.exit(0);
});

// Start the server
app.listen(port, () => {
  logger.info(`Queue service listening on port ${port}`);
});
