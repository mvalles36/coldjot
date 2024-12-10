import Bull from "bull";
import { prisma } from "@mailjot/database";
import { logger } from "./logger";
import {
  ProcessingJob,
  EmailJob,
  JobCounts,
  ProcessingResult,
  EmailTracking,
  GoogleAccount,
} from "../types/queue";
import { SchedulingService } from "./scheduling-service";
import { StepStatus, StepType, TimingType, SequenceStep } from "@mailjot/types";
import { calculateNextSendTime } from "./timing-service";
import { rateLimiter } from "./rate-limiter";
import { emailProcessor } from "./email-processor";

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
        // Check rate limits first
        const { allowed, info } = await rateLimiter.checkRateLimit(
          data.userId,
          data.sequenceId
        );

        if (!allowed) {
          logger.warn("Rate limit exceeded:", info);
          return { success: false, error: "Rate limit exceeded" };
        }

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
          // Check contact rate limit
          const contactRateLimit = await rateLimiter.checkRateLimit(
            data.userId,
            data.sequenceId,
            contact.contact.id
          );

          if (!contactRateLimit.allowed) {
            logger.warn("Contact rate limit exceeded:", contactRateLimit.info);
            continue;
          }

          // Get contact's progress
          const progress = await prisma.sequenceProgress.findFirst({
            where: {
              sequenceId: data.sequenceId,
              contactId: contact.contact.id,
            },
          });

          // Get the current step for this contact
          const currentStepIndex = progress?.currentStepIndex || 0;
          const currentStep = sequence.steps[currentStepIndex];

          if (!currentStep) {
            // Sequence completed for this contact
            await prisma.sequenceContact.update({
              where: { id: contact.id },
              data: {
                status: "completed",
                completedAt: new Date(),
              },
            });
            continue;
          }

          // Calculate next send time based on business hours and step timing
          const nextSendTime = await calculateNextSendTime(
            currentStep.timing as "immediate" | "delay",
            {
              amount: currentStep.delayAmount || 0,
              unit:
                (currentStep.delayUnit as "minutes" | "hours" | "days") ||
                "minutes",
            },
            sequence.businessHours || {
              timezone: "UTC",
              workDays: [1, 2, 3, 4, 5],
              workHoursStart: "09:00",
              workHoursEnd: "17:00",
              holidays: [],
            }
          );

          if (!nextSendTime) {
            logger.warn(
              `Could not calculate next send time for step ${currentStep.id}`
            );
            continue;
          }

          // Get user's email account
          const account = await prisma.user.findUnique({
            where: { id: data.userId },
            select: {
              email: true,
              accounts: {
                where: {
                  provider: "google",
                },
                select: {
                  access_token: true,
                  refresh_token: true,
                  expires_at: true,
                },
                take: 1,
              },
            },
          });

          if (
            !account?.email ||
            !account.accounts[0]?.access_token ||
            !account.accounts[0]?.refresh_token
          ) {
            throw new Error(
              `No valid email account found for user ${data.userId}`
            );
          }

          const googleAccount: GoogleAccount = {
            email: account.email,
            accessToken: account.accounts[0].access_token,
            refreshToken: account.accounts[0].refresh_token,
            expiryDate: account.accounts[0].expires_at || 0,
          };

          const tracking: EmailTracking = {
            enabled: true,
            openTracking: true,
            clickTracking: true,
            unsubscribeTracking: true,
          };

          // Add email job to the queue
          await this.addEmailJob({
            type: "send",
            priority: 1,
            data: {
              sequenceId: sequence.id,
              contactId: contact.contact.id,
              stepId: currentStep.id,
              userId: data.userId,
              emailOptions: {
                to: data.testMode
                  ? process.env.TEST_EMAIL || googleAccount.email
                  : contact.contact.email,
                subject: currentStep.subject || "",
                html: currentStep.content || "",
                replyTo: googleAccount.email,
                threadId: contact.threadId || undefined,
              },
              tracking,
              account: googleAccount,
            },
          });

          // Update progress
          await prisma.sequenceProgress.upsert({
            where: {
              sequenceId_contactId: {
                sequenceId: sequence.id,
                contactId: contact.contact.id,
              },
            },
            update: {
              currentStepIndex: currentStepIndex + 1,
              lastProcessedAt: new Date(),
              nextScheduledAt: nextSendTime,
            },
            create: {
              sequenceId: sequence.id,
              contactId: contact.contact.id,
              currentStepIndex: 1,
              lastProcessedAt: new Date(),
              nextScheduledAt: nextSendTime,
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

          // Increment rate limit counters
          await rateLimiter.incrementCounters(
            data.userId,
            sequence.id,
            contact.contact.id
          );

          // Add rate limiting delay between contacts
          await new Promise((resolve) => setTimeout(resolve, 1000));
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
        const emailJob: EmailJob = {
          type: data.type,
          priority: job.opts.priority || 1,
          data: job.data,
        };

        switch (data.type) {
          case "send":
            await emailProcessor.processEmail(emailJob);
            break;
          case "bounce_check":
            await emailProcessor.checkBounce(emailJob);
            break;
          default:
            throw new Error(`Unknown email job type: ${data.type}`);
        }

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
