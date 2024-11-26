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
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepType: StepType;
  status: string;
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
  createdAt: Date;
  updatedAt: Date;
  templateId?: string;
}

export interface SequenceContact {
  id: string;
  sequenceId: string;
  contactId: string;
  status: StepStatus;
  currentStepId?: string;
  startedAt: Date;
  completedAt?: Date;
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
  active: number;
  paused: number;
  finished: number;
  bounced: number;
  notSent: number;
  scheduled: number;
  delivered: number;
  replied: number;
  interested: number;
  optedOut: number;
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
  templateId?: string;
}
