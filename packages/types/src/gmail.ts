// Types
export interface GmailClientOptions {
  userId?: string;
  accessToken: string;
  tokenType?: string;
}

export interface GmailClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GmailCredentials {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiryDate?: number;
}

export interface SendGmailOptions {
  to: string;
  subject: string;
  content: string;
  threadId?: string;
  originalContent?: string;
  accessToken?: string;
}

export interface GmailResponse {
  messageId: string;
  threadId?: string;
}

export interface UpdateSentEmailOptions {
  to: string;
  subject: string;
  accessToken: string;
  messageId: string;
  originalContent: string;
  threadId?: string;
}
