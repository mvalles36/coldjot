// export interface ThreadCheckData {
//   threadId: string;
//   userId: string;
//   sequenceId: string;
//   contactId: string;
//   lastCheckedAt: Date;
//   createdAt: Date;
// }

export interface ThreadCheckData {
  threadId: string;
  userId: string;
  sequenceId: string;
  contactId: string;
  messageId: string;
  createdAt: Date;
}

export interface ThreadMetadata {
  lastCheckedAt?: string;
  [key: string]: any;
}
