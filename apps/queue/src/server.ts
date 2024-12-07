import express from "express";
import cors from "cors";
import { queueService } from "./lib/queue-service";
import { logger } from "./lib/logger";
import { env } from "./config";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Add sequence to queue
app.post("/api/sequences/:id/process", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const job = await queueService.addSequenceJob({
      sequenceId: id,
      userId,
      priority: 1,
    });

    res.json({ jobId: job.id });
  } catch (error) {
    logger.error("Error adding sequence job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add email to queue
app.post("/api/emails/send", async (req, res) => {
  try {
    const { sequenceId, stepId, contactId, userId } = req.body;

    if (!sequenceId || !stepId || !contactId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const job = await queueService.addEmailJob({
      sequenceId,
      stepId,
      contactId,
      userId,
      priority: 2,
    });

    res.json({ jobId: job.id });
  } catch (error) {
    logger.error("Error adding email job:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get job status
app.get("/api/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (!type || typeof type !== "string") {
      return res
        .status(400)
        .json({ error: "type query parameter is required" });
    }

    const status = await queueService.getJobStatus(id, type);
    res.json(status);
  } catch (error) {
    logger.error("Error getting job status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  logger.info(`Queue server listening on port ${port}`);
});
