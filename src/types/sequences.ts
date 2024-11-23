export type SequenceStatus = "draft" | "active" | "paused" | "completed";
export type StepStatus =
  | "not_sent"
  | "scheduled"
  | "sent"
  | "bounced"
  | "replied"
  | "interested"
  | "opted_out";
export type StepPriority = "high" | "medium" | "low";
export type StepTiming = "immediate" | "delay";
export type StepType = "manual_email";

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
  status: StepStatus;
  priority: StepPriority;
  timing: StepTiming;
  delayAmount?: number;
  delayUnit?: "minutes" | "hours" | "days";
  subject?: string;
  content?: string;
  includeSignature: boolean;
  note?: string;
  order: number;
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
