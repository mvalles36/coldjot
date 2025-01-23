export interface Mailbox {
  id?: string;
  name?: string;
  userId?: string;
  email?: string;
  providerAccountId?: string;
  accessToken: string;
  refreshToken: string;
  expiryDate?: number; // Optional since it's only in one interface
  // aliases?: EmailAlias[];
  // defaultAliasId?: string;
}

export interface EmailAlias {
  id: string;
  alias: string;
  name?: string | null;
  isActive: boolean;
}

export interface TokenRefreshError extends Error {
  code?: string;
  status?: number;
}
