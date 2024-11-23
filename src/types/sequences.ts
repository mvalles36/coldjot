export type SequenceStatus = "draft" | "active" | "paused" | "completed";
export type StepStatus =
  | "active"
  | "paused"
  | "not_sent"
  | "bounced"
  | "finished";
export type StepPriority = "high" | "medium" | "low";
export type StepTiming = "immediate" | "delay";
export type StepType = "manual_email";

export interface Sequence {
  id: string;
  name: string;
  status: SequenceStatus;
  permissions: "team" | "private";
  schedule: "business" | "custom";
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  steps: SequenceStep[];
  contactCount: number;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  type: StepType;
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
}
