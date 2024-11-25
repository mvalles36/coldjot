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
