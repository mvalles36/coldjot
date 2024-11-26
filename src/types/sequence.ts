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
