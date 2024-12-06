export type SequenceStatus = "draft" | "active" | "paused" | "completed";
export type StepStatus =
  | "not_sent"
  | "scheduled"
  | "in_progress"
  | "sent"
  | "failed"
  | "bounced"
  | "replied"
  | "interested"
  | "opted_out"
  | "completed";
export type StepPriority = "high" | "medium" | "low";
export type StepTiming = "immediate" | "delay";
export type StepType = "manual_email" | "automated_email";

export interface DevSettings {
  disableSending: boolean;
  testEmails: string[];
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
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepType: StepType;
  status: StepStatus;
  priority: StepPriority;
  timing: StepTiming;
  delayAmount?: number;
  delayUnit?: string;
  subject?: string;
  content?: string;
  includeSignature: boolean;
  note?: string;
  order: number;
  previousStepId?: string;
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
  avgResponseTime: number | null;
  createdAt: Date;
  updatedAt: Date;
  contactId: string | null;
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
