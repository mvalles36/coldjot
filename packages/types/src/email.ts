import type { gmail_v1 } from "googleapis";
export type MessagePartHeader = gmail_v1.Schema$MessagePartHeader;
export type Gmail = gmail_v1.Gmail;
export type Message = gmail_v1.Schema$Message;
import type { EmailTracking } from "./sequences";
import { GoogleAccount } from "./queue";

// export interface SendEmailOptions {
//   to: string;
//   subject: string;
//   content: string;
//   threadId?: string;
//   accessToken?: string;
//   originalContent?: string;
// }

export interface CreateDraftOptions {
  to: string;
  subject: string;
  content: string;
  accessToken: string;
}

export interface SendDraftOptions {
  draftId: string;
  accessToken: string;
}

export interface EmailResponse {
  messageId: string;
  threadId?: string;
}

// Add new types and utilities for email threading
export interface ThreadHeaders {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}
export interface EmailResult {
  messageId: string;
  threadId: string;
  success?: boolean;
  error?: string;
}

interface GmailAccountCredentials {
  accessToken: string;
  refreshToken: string;
  email?: string;
  expiryDate?: number;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  threadId?: string;
  tracking: EmailTracking;
  account: GoogleAccount;
  userId: string;
  sequenceId: string;
  contactId: string;
  stepId: string;
  testMode?: boolean;
}
