export enum StepType {
  MANUAL_EMAIL = "manual_email",
  AUTOMATED_EMAIL = "automated_email",
  WAIT = "wait",
  CONDITION = "condition",
  ACTION = "action",
}

export enum TimingType {
  IMMEDIATE = "immediate",
  DELAY = "delay",
  SCHEDULED = "scheduled",
}

export enum StepPriority {
  HIGH = "high",
  NORMAL = "normal",
  LOW = "low",
}

export enum StepStatus {
  NOT_SENT = "not_sent",
  DRAFT = "draft",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  ERROR = "error",
}

export enum SequenceStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  ERROR = "error",
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepType: StepType;
  status: StepStatus;
  priority: StepPriority;
  timing: TimingType;
  delayAmount?: number | null;
  delayUnit?: string | null;
  subject?: string | null;
  content?: string | null;
  includeSignature: boolean;
  note?: string | null;
  order: number;
  previousStepId?: string | null;
  replyToThread: boolean;
  threadId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  templateId?: string | null;
}

export interface Sequence {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: SequenceStatus;
  accessLevel: "team" | "private";
  scheduleType: "business" | "custom";
  businessHours?: BusinessHours;
  steps: SequenceStep[];
  contacts: SequenceContact[];
  _count: {
    contacts: number;
  };
  testMode: boolean;
  createdAt: Date;
  updatedAt: Date;
  emailListId?: string | null;
}

export interface SequenceContact {
  id: string;
  sequenceId: string;
  contactId: string;
  status: StepStatus;
  currentStep: number;
  startedAt: Date;
  updatedAt: Date;
  lastProcessedAt?: Date | null;
  completedAt?: Date | null;
  threadId?: string | null;
  contact: {
    id: string;
    name: string;
    email: string;
    company?: {
      name: string;
    } | null;
  };
}

export interface BusinessHours {
  timezone: string;
  workDays: number[];
  workHours: {
    start: string;
    end: string;
  };
  holidays: Date[];
}

export interface SequenceStats {
  id: string;
  sequenceId: string;
  contactId?: string | null;
  totalEmails: number;
  sentEmails: number;
  openedEmails: number;
  uniqueOpens: number;
  clickedEmails: number;
  repliedEmails: number;
  bouncedEmails: number;
  failedEmails: number;
  avgOpenTime?: number | null;
  avgClickTime?: number | null;
  avgReplyTime?: number | null;
  avgResponseTime?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessingWindow {
  start: Date;
  end: Date;
  timezone: string;
  maxJobsPerWindow: number;
  currentLoad: number;
}

export interface RateLimits {
  perMinute: number;
  perHour: number;
  perDay: number;
  perContact: number;
  perSequence: number;
  cooldown: {
    afterBounce: number;
    afterError: number;
  };
}
