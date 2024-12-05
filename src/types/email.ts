export interface SendEmailOptions {
  to: string;
  subject: string;
  content: string;
  threadId?: string;
  accessToken?: string;
  originalContent?: string;
}

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
  threadId?: string;
}
