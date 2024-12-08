import Bull from "bull";
import { prisma } from "@mailjot/database";
import { logger } from "./logger";
import {
  ProcessingJob,
  EmailJob,
  JobCounts,
  ProcessingResult,
} from "../types/queue";
import { SchedulingService } from "./scheduling-service";
import { StepStatus, StepType, TimingType, SequenceStep } from "@mailjot/types";

export class QueueService {
  private sequenceQueue: Bull.Queue;
  private emailQueue: Bull.Queue;
  private schedulingService: SchedulingService;

  constructor() {
    this.sequenceQueue = new Bull("sequence-processing", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      prefix: "mailjot",
    });

    this.emailQueue = new Bull("email-sending", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD,
      },
      prefix: "mailjot",
    });

    this.schedulingService = new SchedulingService();

    // Set up queue processors
    this.setupProcessors();
  }

  private setupProcessors() {
    // Process sequence jobs
    this.sequenceQueue.process(async (job) => {
      const { data } = job;
      logger.info(`Processing sequence job: ${job.id}`, {
        sequenceId: data.sequenceId,
      });

      try {
        // Get sequence and its steps
        const sequence = await prisma.sequence.findUnique({
          where: { id: data.sequenceId },
          include: {
            steps: {
              orderBy: { order: "asc" },
            },
            businessHours: true,
          },
        });

        if (!sequence) {
          throw new Error("Sequence not found");
        }

        // Process each contact in the sequence
        const contacts = await prisma.sequenceContact.findMany({
          where: {
            sequenceId: data.sequenceId,
            status: {
              notIn: ["completed", "opted_out"],
            },
          },
          include: {
            contact: true,
          },
        });

        for (const contact of contacts) {
          // Get the current step for this contact
          const currentStep = sequence.steps[contact.currentStep];
          if (!currentStep) continue;

          // Calculate next run time based on business hours and step timing
          const nextRun = this.schedulingService.calculateNextRun(
            new Date(),
            {
              ...currentStep,
              stepType: currentStep.stepType as StepType,
              timing: currentStep.timing as TimingType,
            } as SequenceStep,
            sequence.businessHours || undefined
          );

          // Add email job to the queue
          await this.addEmailJob({
            type: "send",
            priority: 1,
            data: {
              sequenceId: sequence.id,
              contactId: contact.id,
              stepId: currentStep.id,
              emailOptions: {
                to: contact.contact.email,
                subject: currentStep.subject || "",
                html: currentStep.content || "",
                replyTo: undefined, // TODO: Get from settings
                threadId: contact.threadId || undefined,
              },
              tracking: {
                enabled: true,
                openTracking: true,
                clickTracking: true,
                unsubscribeTracking: true,
              },
              account: {
                email: "", // TODO: Get from settings
                accessToken: "", // TODO: Get from settings
                refreshToken: "", // TODO: Get from settings
                expiryDate: 0, // TODO: Get from settings
              },
            },
          });

          // Update contact status
          await prisma.sequenceContact.update({
            where: { id: contact.id },
            data: {
              status: StepStatus.SCHEDULED,
              lastProcessedAt: new Date(),
            },
          });
        }

        return { success: true };
      } catch (error) {
        logger.error(`Error processing sequence job: ${job.id}`, error);
        throw error;
      }
    });

    // Process email jobs
    this.emailQueue.process(async (job) => {
      const { data } = job;
      logger.info(`Processing email job: ${job.id}`, {
        sequenceId: data.sequenceId,
        contactId: data.contactId,
      });

      try {
        // TODO: Implement email sending logic
        // This will involve:
        // 1. Getting the email template
        // 2. Personalizing the content
        // 3. Adding tracking pixels/links
        // 4. Sending via Gmail API
        // 5. Updating stats and status

        return { success: true };
      } catch (error) {
        logger.error(`Error processing email job: ${job.id}`, error);
        throw error;
      }
    });
  }

  // Add a sequence processing job
  async addSequenceJob(job: ProcessingJob): Promise<Bull.Job> {
    return this.sequenceQueue.add(job.data, {
      priority: job.priority,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
  }

  // Add an email sending job
  async addEmailJob(job: EmailJob): Promise<Bull.Job> {
    return this.emailQueue.add(job.data, {
      priority: job.priority,
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    });
  }

  // Schedule a job for later processing
  async scheduleJob(job: Bull.Job, nextRun: Date): Promise<Bull.Job> {
    const nextRunDelay = nextRun.getTime() - Date.now();
    await job.remove();
    return this.sequenceQueue.add(job.data, {
      delay: nextRunDelay,
      jobId: job.id,
      priority: job.opts.priority,
    });
  }

  // Get job counts for monitoring
  async getJobCounts(): Promise<JobCounts> {
    const [sequenceCounts, emailCounts] = await Promise.all([
      this.sequenceQueue.getJobCounts(),
      this.emailQueue.getJobCounts(),
    ]);

    return {
      waiting: sequenceCounts.waiting + emailCounts.waiting,
      active: sequenceCounts.active + emailCounts.active,
      completed: sequenceCounts.completed + emailCounts.completed,
      failed: sequenceCounts.failed + emailCounts.failed,
      delayed: sequenceCounts.delayed + emailCounts.delayed,
    };
  }

  // Get completed jobs for metrics calculation
  async getCompletedJobs(sequenceId?: string): Promise<Bull.Job[]> {
    const jobs = await this.sequenceQueue.getCompleted();
    if (sequenceId) {
      return jobs.filter((job) => job.data.sequenceId === sequenceId);
    }
    return jobs;
  }

  // Clean up completed and failed jobs
  async cleanup(age: number = 24 * 60 * 60 * 1000): Promise<void> {
    await Promise.all([
      this.sequenceQueue.clean(age, "completed"),
      this.sequenceQueue.clean(age, "failed"),
      this.emailQueue.clean(age, "completed"),
      this.emailQueue.clean(age, "failed"),
    ]);
  }
}
