export interface PubSubMessage {
  messageId: string;
  data: string;
  publishTime: string;
  attributes?: Record<string, string>;
}

export interface PubSubPushRequest {
  message: PubSubMessage;
  subscription: string;
}

export interface DecodedNotification {
  emailAddress: string;
  historyId: string | number;
}

export interface MessageDetails {
  id: string;
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  labelIds: string[];
  isReply: boolean;
  headers: Array<{ name: string; value: string }>;
}

export enum NotificationType {
  PROCESSING = "PROCESSING",
  MESSAGE_ADDED = "MESSAGE_ADDED",
  REPLY = "REPLY",
  BOUNCE = "BOUNCE",
  HISTORY_GAP = "HISTORY_GAP",
  ORIGINAL_MESSAGE = "ORIGINAL_MESSAGE",
}

export interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

export interface HistoryChange {
  id: string;
  threadId: string;
  type: NotificationType;
  messageId: string;
  from: string;
}

export interface NotificationRecord {
  id: string;
  emailWatchId: string;
  historyId: string;
  notificationType: NotificationType;
  processed: boolean;
  createdAt: Date;
  data?: Record<string, any>;
}

export interface GmailHistoryRecord {
  id: string;
  messagesAdded?: Array<{
    message: GmailMessageMetadata;
  }>;
  labelsAdded?: Array<{
    message: GmailMessageMetadata;
  }>;
  labelsRemoved?: Array<{
    message: GmailMessageMetadata;
  }>;
}

export interface GmailMessageMetadata {
  id: string;
  threadId: string;
  labelIds: string[];
  payload: {
    headers: Array<{
      name: string;
      value: string;
    }>;
    body?: {
      size: number;
    };
    parts?: Array<{
      body: {
        size: number;
      };
    }>;
  };
}
