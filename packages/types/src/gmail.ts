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
