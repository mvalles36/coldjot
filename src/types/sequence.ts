export interface Sequence {
  id: string;
  name: string;
  status: string;
  steps: any[];
  contacts: any[];
  accessLevel: string;
  scheduleType: string;
  _count: {
    contacts: number;
  };
  testMode: boolean;
  stats?: SequenceStats | null;
}

export interface DevSettings {
  disableSending: boolean;
  testEmails: string[];
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepType: string;
  status: string;
  priority: string;
  timing: string;
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
}

export interface SequenceStats {
  id: string;
  sequenceId: string;
  totalEmails: number;
  sentEmails: number;
  openedEmails: number;
  clickedEmails: number;
  repliedEmails: number;
  bouncedEmails: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  avgResponseTime: number | null;
  updatedAt: Date;
  createdAt: Date;
}
