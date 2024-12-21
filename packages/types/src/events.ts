// Define EmailEventType based on the schema enum
export type EmailEventType =
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced"
  | "spam"
  | "unsubscribed"
  | "interested";

export type EmailTrackingStatus =
  | "pending"
  | "sent"
  | "opened"
  | "clicked"
  | "bounced"
  | "spam"
  | "unsubscribed";

export interface EmailTrackingMetadata {
  email: string;
  userId: string;
  sequenceId?: string;
  stepId?: string;
  contactId?: string;
  [key: string]: any;
}

export interface EmailEventMetadata {
  messageId?: string;
  threadId?: string;
  stepId?: string;
  openCount?: number;
  linkId?: string;
  originalUrl?: string;
  bounceReason?: string;
  [key: string]: any;
}

export interface EmailTracking {
  id: string;
  hash: string;
  metadata: EmailTrackingMetadata;
  type: "sequence" | "campaign";
  pixel: string;
  wrappedLinks: boolean;
  trackingId: string;
}
