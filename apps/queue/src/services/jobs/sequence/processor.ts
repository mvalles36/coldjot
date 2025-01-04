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
import { QUEUE_NAMES } from "@/config";
import { getWorkerOptions } from "@/config";
import { BaseProcessor } from "../base-processor";
import { ServiceManager } from "@/services/service-manager";
import { processContactShared } from "./helper";

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
    super(queue, QUEUE_NAMES.SEQUENCE, getWorkerOptions(QUEUE_NAMES.SEQUENCE));

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

      // TODO :  Make this a separate job in batch
      // Get active contacts
      const contacts = await getActiveSequenceContacts(data.sequenceId);
      logger.info(`👥 Processing contacts:`, {
        total: contacts.length,
        sequence: sequence.name,
      });

      // TODO : Check if this is needed
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
    await processContactShared(
      {
        sequence,
        contact: sequenceContact.contact,
        currentStep: sequenceContact.currentStep || 1,
        testMode: data.testMode,
        threadId: sequenceContact.threadId,
        startedAt: sequenceContact.startedAt,
      },
      this.jobManager
    );
  }
}
