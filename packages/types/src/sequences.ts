export enum StepType {
  MANUAL_EMAIL = "MANUAL_EMAIL",
  AUTOMATED_EMAIL = "AUTOMATED_EMAIL",
  WAIT = "WAIT",
  CONDITION = "CONDITION",
  ACTION = "ACTION",
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
  PENDING = "pending",
  SCHEDULED = "scheduled",
  SENT = "sent",
  FAILED = "failed",
  BOUNCED = "bounced",
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
  timing: StepTiming;
  delayAmount?: number | null;
  delayUnit?: string | null;
  subject?: string | null;
  content?: string | null;
  includeSignature: boolean;
  note?: string | null;
  order: number;
  previousStepId?: string | null;
  replyToThread?: boolean;
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
  workHoursStart: string;
  workHoursEnd: string;
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

// ------------------------
// ------------------------
// ------------------------

// export type SequenceStatus = "draft" | "active" | "paused" | "completed";
// export type StepStatus =
//   | "not_sent"
//   | "scheduled"
//   | "in_progress"
//   | "sent"
//   | "failed"
//   | "bounced"
//   | "replied"
//   | "interested"
//   | "opted_out"
//   | "completed";
// export type StepPriority = "high" | "medium" | "low";
export type StepTiming = "immediate" | "delay";
// export type StepType = "manual_email" | "automated_email";

export interface DevSettings {
  disableSending: boolean;
  testEmails: string[];
}

export interface BusinessHours {
  timezone: string;
  workDays: number[];
  workHoursStart: string;
  workHoursEnd: string;
  holidays: Date[];
}

export interface Sequence {
  id: string;
  name: string;
  status: SequenceStatus;
  accessLevel: "team" | "private";
  scheduleType: "business" | "custom";
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  steps: SequenceStep[];
  contacts: SequenceContact[];
  _count: {
    contacts: number;
  };
  testMode: boolean;
  emailListId?: string | null;
  businessHours?: BusinessHours;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepType: StepType;
  status: StepStatus;
  priority: StepPriority;
  timing: StepTiming;
  delayAmount?: number | null;
  delayUnit?: string | null;
  subject?: string | null;
  content?: string | null;
  includeSignature: boolean;
  note?: string | null;
  order: number;
  previousStepId?: string | null;
  replyToThread?: boolean;
  threadId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  templateId?: string | null;
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

export interface SequenceStats {
  id: string;
  sequenceId: string;
  totalEmails: number;
  sentEmails: number;
  openedEmails: number;
  uniqueOpens: number;
  clickedEmails: number;
  repliedEmails: number;
  bouncedEmails: number;
  unsubscribed: number;
  interested: number;
  peopleContacted: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  avgResponseTime?: number | null;
  createdAt: Date;
  updatedAt: Date;
  contactId?: string | null;
  Contact?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface StepData {
  stepType: StepType;
  timing: StepTiming;
  priority: StepPriority;
  delayAmount?: number;
  delayUnit?: "minutes" | "hours" | "days";
  maxEmailsPerDay?: number;
  skipIfPastDue?: boolean;
  note?: string;
}

export interface EmailData {
  subject: string;
  content: string;
  includeSignature: boolean;
  replyToThread?: boolean;
  templateId?: string;
}

export interface EmailTrackingMetadata {
  email: string;
  userId: string;
  sequenceId: string;
  stepId: string;
  contactId: string;
  hash?: string;
  trackingId?: string;
}

export interface EmailTracking {
  id: string;
  hash: string;
  type: string;
  wrappedLinks: boolean;
  metadata: EmailTrackingMetadata;
  pixel?: string;
  trackingId?: string;
}

export interface SequenceEmailTracking {
  emailId: string;
  userId: string;
  sequenceId: string;
  metadata: EmailTrackingMetadata;
}

export interface EmailEventMetadata {
  messageId?: string;
  threadId?: string;
  from?: string;
  snippet?: string;
  timestamp?: string;
  replyMessageId?: string;
  bounceReason?: string;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  deviceType?: string;
}

export interface EmailEventMetadata {
  [key: string]: string | number | boolean | null | undefined;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  deviceType?: string;
  replyMessageId?: string;
  bounceReason?: string;
}
