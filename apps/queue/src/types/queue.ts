import {
  BusinessHours,
  SequenceStep,
  StepType,
  TimingType,
  StepPriority,
  ProcessingWindow,
  RateLimits,
} from "@mailjot/types";

export interface ProcessingJob {
  type: "sequence" | "step" | "contact";
  id: string;
  priority: number;
  data: {
    sequenceId: string;
    contactId?: string;
    stepId?: string;
    userId: string;
    scheduleType: "business" | "custom";
    businessHours?: BusinessHours;
  };
}

export interface EmailJob {
  type: "send" | "retry" | "bounce_check";
  priority: number;
  data: {
    sequenceId: string;
    contactId: string;
    stepId: string;
    emailOptions: SendEmailOptions;
    tracking: EmailTracking;
    account: GoogleAccount;
  };
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  threadId?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType: string;
  }>;
}

export interface EmailTracking {
  enabled: boolean;
  openTracking: boolean;
  clickTracking: boolean;
  unsubscribeTracking: boolean;
}

export interface GoogleAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}

// Re-export types from @mailjot/types for convenience
export { StepType, TimingType, StepPriority };
