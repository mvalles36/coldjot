export interface GoogleAccount {
  userId?: string;
  email?: string; // Optional since it's only in one interface
  providerAccountId?: string;
  accessToken: string;
  refreshToken: string;
  expiryDate?: number; // Optional since it's only in one interface
}

export interface TokenRefreshError extends Error {
  code?: string;
  status?: number;
}
