import express from "express";
import cors from "cors";
import { env } from "./config";
import { prisma } from "@mailjot/database";
import { QueueService } from "./lib/queue-service";
import { SchedulingService } from "./lib/scheduling-service";
import { logger } from "./lib/logger";
import {
  StepType,
  StepPriority,
  TimingType,
  StepStatus,
  BusinessHours,
} from "@mailjot/types";

const app = express();
const port = process.env.PORT || 3001;

// Initialize services
const queueService = new QueueService();
const schedulingService = new SchedulingService();

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to get business hours
async function getBusinessHours(
  userId: string
): Promise<BusinessHours | undefined> {
  const settings = await prisma.businessHoursSettings.findFirst({
    where: { userId },
  });

  if (!settings) {
    return undefined;
  }

  return {
    timezone: settings.timezone,
    workDays: settings.workDays,
    workHours: {
      start: settings.workHoursStart,
      end: settings.workHoursEnd,
    },
    holidays: settings.holidays,
  };
}

// Helper function to get the first step of a sequence
async function getFirstSequenceStep(sequenceId: string) {
  const step = await prisma.sequenceStep.findFirst({
    where: {
      sequenceId,
      previousStepId: null, // First step has no previous step
    },
    orderBy: {
      order: "asc",
    },
  });

  if (!step) return null;

  return {
    id: step.id,
    sequenceId: step.sequenceId,
    stepType: step.stepType as StepType,
    status:
      step.status.toUpperCase() === "NOT_SENT"
        ? StepStatus.NOT_SENT
        : (step.status as StepStatus),
    priority: step.priority as StepPriority,
    timing: step.timing as TimingType,
    delayAmount: step.delayAmount,
    delayUnit: step.delayUnit,
    subject: step.subject,
    content: step.content,
    includeSignature: step.includeSignature || false,
    note: step.note,
    order: step.order,
    previousStepId: step.previousStepId,
    replyToThread: step.replyToThread || false,
    threadId: step.threadId,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
    templateId: step.templateId,
  };
}

// Add sequence to queue
app.post("/api/sequences/:id/process", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    // Get business hours settings
    const businessHours = await getBusinessHours(userId);

    // Get the first step of the sequence
    const firstStep = await getFirstSequenceStep(id);
    if (!firstStep) {
      return res.status(400).json({ error: "No steps found in sequence" });
    }

    // Create and schedule the job
    const job = await queueService.addSequenceJob({
      type: "sequence",
      id,
      priority: 1,
      data: {
        sequenceId: id,
        userId,
        scheduleType: businessHours ? "business" : "custom",
        businessHours,
      },
    });

    const nextRun = schedulingService.calculateNextRun(
      new Date(),
      firstStep,
      businessHours
    );

    const scheduledJob = await queueService.scheduleJob(job, nextRun);

    res.json({ jobId: scheduledJob.id });
  } catch (error) {
    logger.error("Error processing sequence:", error);
    res.status(500).json({ error: "Failed to process sequence" });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Queue service listening on port ${port}`);
});
