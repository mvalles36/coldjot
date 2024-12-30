import { Queue, Job } from "bullmq";
import {
  ProcessingJob,
  EmailJob,
  EmailJobEnum,
  SequenceContactStatusEnum,
  SequenceStep,
  StepStatus,
  StepPriority,
  StepTiming,
  StepTypeEnum,
  BusinessHours,
  StepType,
  BusinessScheduleEnum,
} from "@mailjot/types";
import { logger } from "@/lib/log";
import { RateLimitService } from "@/services/core/rate-limit/service";
import { ScheduleGenerator, scheduleGenerator } from "@/lib/schedule";
import { randomUUID } from "crypto";
import { prisma } from "@mailjot/database";
import {
  getUserGoogleAccount,
  getDefaultBusinessHours,
  updateSequenceContactStatus,
  updateSequenceContactProgress,
  getActiveSequenceContacts,
  getSequenceWithDetails,
  getContactProgress,
} from "./helper";
import { QUEUE_NAMES } from "@/config/queue/queue";
import { BaseProcessor } from "../base-processor";
import { ServiceManager } from "@/services/service-manager";

// Define our sequence processing types
interface SequenceWithRelations {
  id: string;
  userId: string;
  name?: string;
  steps: {
    id: string;
    sequenceId: string;
    stepType: StepTypeEnum;
    priority: StepPriority;
    timing: StepTiming;
    delayAmount: number | null;
    delayUnit: string | null;
    subject: string | null;
    order: number;
    replyToThread: boolean;
    templateId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  businessHours: BusinessHours | null;
}

interface SequenceContactWithRelations {
  id: string;
  sequenceId: string;
  contactId: string;
  currentStep: number;
  lastProcessedAt: Date | null;
  nextScheduledAt: Date | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sequence: SequenceWithRelations;
  contact: {
    id: string;
    email: string;
  };
  threadId?: string;
}

interface ProcessingJobData {
  sequenceId: string;
  userId: string;
  scheduleType?: BusinessScheduleEnum;
  businessHours?: BusinessHours;
  testMode?: boolean;
}

export class SequenceProcessor extends BaseProcessor<ProcessingJobData> {
  private rateLimitService: RateLimitService;
  private scheduleGenerator: ScheduleGenerator;

  private serviceManager = ServiceManager.getInstance();
  private jobManager = this.serviceManager.getJobManager();

  constructor(queue: Queue) {
    super(queue, QUEUE_NAMES.SEQUENCE, {
      concurrency: 5,
      limiter: {
        max: 100,
        duration: 1000, // 1 second
      },
      connection: {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    });
    this.rateLimitService = RateLimitService.getInstance();
    this.scheduleGenerator = scheduleGenerator;
  }

  protected async process(job: Job<ProcessingJobData>): Promise<void> {
    try {
      const result = await this.processSequence(job.data);
      if (!result.success) {
        throw new Error(result.error || "Failed to process sequence");
      }
    } catch (error) {
      logger.error(`Failed to process sequence job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Process a sequence job
   */
  private async processSequence(
    data: ProcessingJobData
  ): Promise<{ success: boolean; error?: string }> {
    logger.info(`🚀 Starting sequence: ${data.sequenceId}`, {
      testMode: data.testMode ? "✨ Test Mode" : "🔥 Production Mode",
    });

    try {
      // Check rate limits first
      const { allowed, info } = await this.rateLimitService.checkRateLimit(
        data.userId,
        data.sequenceId
      );

      if (!allowed) {
        logger.warn("⚠️ Rate limit exceeded:", info);
        return { success: false, error: "Rate limit exceeded" };
      }

      // Get sequence and validate
      const dbSequence = await getSequenceWithDetails(data.sequenceId);
      logger.info(dbSequence, "🎮 Sequence");

      if (!dbSequence) {
        throw new Error("Sequence not found");
      }

      // Cast database sequence to our expected type
      const sequence: SequenceWithRelations = {
        ...dbSequence,
        steps: dbSequence.steps.map((step) => ({
          ...step,
          stepType: step.stepType as StepTypeEnum,
          priority: step.priority as StepPriority,
          timing: step.timing as StepTiming,
          subject: step.subject,
          replyToThread: step.replyToThread ?? false,
          templateId: step.templateId,
        })),
      };

      logger.info(`📋 Sequence details for ${sequence.name}:`, {
        steps: sequence.steps.length,
        businessHours: sequence.businessHours ? "✓" : "✗",
      });

      // Get active contacts
      const contacts = await getActiveSequenceContacts(data.sequenceId);
      logger.info(`👥 Processing contacts:`, {
        total: contacts.length,
        sequence: sequence.name,
      });

      // Get user's Google account
      const googleAccount = await getUserGoogleAccount(data.userId);
      if (!googleAccount) {
        throw new Error(`No valid email account found for user ${data.userId}`);
      }

      // Process each contact
      for (const sequenceContact of contacts) {
        try {
          await this.processContact(
            sequenceContact,
            sequence,
            data,
            googleAccount
          );
        } catch (error) {
          logger.error(
            error,
            `❌ Error processing contact ${sequenceContact.contact.email}:`
          );
          // Continue with next contact even if one fails
          continue;
        }
      }

      logger.info(`✨ Sequence processing completed: ${sequence.name}`, {
        totalContacts: contacts.length,
        totalSteps: sequence.steps.length,
      });

      return { success: true };
    } catch (error) {
      logger.error("❌ Error processing sequence:", error);
      throw error;
    }
  }

  /**
   * Process an individual contact in the sequence
   */
  private async processContact(
    sequenceContact: any,
    sequence: SequenceWithRelations,
    data: ProcessingJobData,
    googleAccount: any
  ): Promise<void> {
    logger.info(`👤 Processing contact: ${sequenceContact.contact.email}`, {
      sequence: sequence.name,
    });

    // Check contact rate limit
    const contactRateLimit = await this.rateLimitService.checkRateLimit(
      data.userId,
      data.sequenceId,
      sequenceContact.contact.id
    );

    if (!contactRateLimit.allowed) {
      logger.warn("⚠️ Contact rate limit exceeded:", contactRateLimit.info);
      return;
    }

    // Get contact's progress
    const progress = await getContactProgress(
      data.sequenceId,
      sequenceContact.contact.id
    );
    const currentStepIndex = progress?.currentStep ?? 0;

    // Log progress status
    logger.info(`📊 Contact progress:`, {
      contact: sequenceContact.contact.email,
      currentStep: currentStepIndex + 1,
      totalSteps: sequence.steps.length,
      hasExistingProgress: !!progress,
    });

    // Check if sequence is completed
    if (currentStepIndex >= sequence.steps.length) {
      logger.info(
        `✅ Sequence completed for contact: ${sequenceContact.contact.email}`
      );
      await updateSequenceContactStatus(
        sequence.id,
        sequenceContact.contact.id,
        SequenceContactStatusEnum.COMPLETED
      );
      return;
    }

    // Get current step
    const currentStep = sequence.steps[currentStepIndex];
    if (!currentStep) {
      logger.error(
        `❌ Step not found at index ${currentStepIndex} for sequence ${sequence.name}`
      );
      return;
    }

    // Get next step
    const nextStep = sequence.steps[currentStepIndex + 1];
    if (!nextStep) {
      logger.info(
        `ℹ️ No next step found - this is the last step for sequence ${sequence.name}`
      );
    }

    // Log step details
    logger.info(`📝 Processing step ${currentStepIndex + 1}:`, {
      step: currentStepIndex + 1,
      totalSteps: sequence.steps.length,
      timing: currentStep.timing,
      delay: {
        amount: currentStep.delayAmount || 0,
        unit: currentStep.delayUnit || "minutes",
      },
    });

    logger.info(
      nextStep,
      "🚀 ~ SequenceProcessor ~ processContact ~ nextStep:"
    );

    // Calculate next send time using scheduling service
    let nextSendTime = null;
    if (nextStep) {
      nextSendTime = this.scheduleGenerator.calculateNextRun(
        new Date(),
        nextStep as SequenceStep,
        sequence.businessHours || getDefaultBusinessHours()
      );
    }

    logger.info(
      `📅 Scheduling email for contact: ${sequenceContact.contact.email}`,
      {
        step: currentStepIndex + 1,
        totalSteps: sequence.steps.length,
        sendTime: nextSendTime?.toISOString() || "N/A",
        subject: currentStep.subject,
      }
    );

    // Get previous subject from previous step if replyToThread is true
    const previousStep = sequence.steps[currentStepIndex - 1];
    const previousSubject = previousStep?.subject || "";
    const subject = currentStep.replyToThread
      ? `Re: ${previousSubject}`
      : currentStep.subject;

    // Create email job
    const emailJob: EmailJob = {
      sequenceId: sequence.id,
      contactId: sequenceContact.contact.id,
      stepId: currentStep.id,
      userId: data.userId,
      to: data.testMode
        ? process.env.TEST_EMAIL || googleAccount.email || ""
        : sequenceContact.contact.email,
      subject: subject || "",
      threadId: sequenceContact.threadId || undefined,
      testMode: data.testMode || false,
      scheduledTime: nextSendTime?.toISOString() || "N/A",
    };

    // Add email job to queue
    logger.info(
      {
        step: currentStepIndex + 1,
        totalSteps: sequence.steps.length,
      },
      `📬 Creating email job`
    );

    // await this.queue.add(QUEUE_NAMES.EMAIL, emailJob.data, {
    //   jobId: emailJob.id,
    //   priority: emailJob.priority,
    //   delay: nextSendTime ? nextSendTime.getTime() - Date.now() : 0,
    // });

    // await this.queue.add(
    //   "wall",
    //   { color: "pink" },
    //   { delay: 10000, removeOnComplete: false, removeOnFail: false }
    // );

    logger.info(
      emailJob,
      `🚀 ~ SequenceProcessor ~ processContact ~ emailJob:`
    );

    await this.jobManager.addEmailJob(emailJob);

    // Update progress
    await updateSequenceContactProgress(
      sequence.id,
      sequenceContact.contact.id,
      currentStepIndex + 1,
      nextSendTime || new Date()
    );

    // Update contact status
    logger.info(
      `📊 Updating contact status: ${sequenceContact.contact.id} to SCHEDULED`
    );
    await updateSequenceContactStatus(
      sequence.id,
      sequenceContact.contact.id,
      SequenceContactStatusEnum.SCHEDULED
    );

    // Increment rate limit counters
    await this.rateLimitService.incrementCounters(
      data.userId,
      sequence.id,
      sequenceContact.contact.id
    );

    // Add rate limiting delay between contacts
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
