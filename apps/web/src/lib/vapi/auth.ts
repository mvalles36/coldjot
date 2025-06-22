import { SignJWT } from "jose";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

// Cache tokens for 10 minutes (in milliseconds)
const TOKEN_CACHE_TIME = 10 * 60 * 1000;

// Interface for Vapi API credentials
interface VapiCredentials {
  apiKey: string;
  orgId: string;
}

// Interface for token data
interface TokenData {
  token: string;
  expiresAt: number;
}

// Cache to store tokens by userId
const tokenCache = new Map<string, TokenData>();

/**
 * Get Vapi credentials for a user from the database
 */
export const getVapiCredentials = cache(async (userId: string): Promise<VapiCredentials | null> => {
  const config = await prisma.vapiConfig.findFirst({
    where: {
      userId,
      isActive: true,
    },
    select: {
      apiKey: true,
      orgId: true,
    },
  });

  return config;
});

/**
 * Generate a JWT token for Vapi API authentication
 */
export async function generateVapiToken(userId: string): Promise<string | null> {
  try {
    // Check if we have a valid cached token
    const cachedToken = tokenCache.get(userId);
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token;
    }

    // Get credentials from database
    const credentials = await getVapiCredentials(userId);
    if (!credentials) {
      console.error("No Vapi credentials found for user:", userId);
      return null;
    }

    // Create token payload
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 10; // 10 minutes in seconds
    const expiresAt = now + expiresIn;

    // Generate JWT token using jose
    const secretKey = new TextEncoder().encode(credentials.apiKey);
    
    const token = await new SignJWT({ org_id: credentials.orgId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(credentials.orgId)
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .sign(secretKey);

    // Cache the token
    tokenCache.set(userId, {
      token,
      expiresAt: expiresAt * 1000, // Convert to milliseconds for cache comparison
    });

    return token;
  } catch (error) {
    console.error("Error generating Vapi token:", error);
    return null;
  }
}

/**
 * Create an authenticated fetch function for Vapi API
 */
export async function createVapiFetch(userId: string) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    try {
      // Get fresh token
      const token = await generateVapiToken(userId);
      if (!token) {
        throw new Error("Failed to generate Vapi authentication token");
      }

      // Prepare headers
      const headers = new Headers(options.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");

      // Make the request
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle common error scenarios
      if (response.status === 401) {
        // Token might be invalid, clear cache and retry once
        tokenCache.delete(userId);
        const newToken = await generateVapiToken(userId);
        
        if (newToken) {
          headers.set("Authorization", `Bearer ${newToken}`);
          return fetch(url, {
            ...options,
            headers,
          });
        } else {
          throw new Error("Failed to refresh Vapi authentication token");
        }
      }

      return response;
    } catch (error) {
      console.error("Error making authenticated Vapi request:", error);
      throw error;
    }
  };
}

/**
 * Make an authenticated request to the Vapi API
 */
export async function fetchVapiApi(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const vapiFetch = await createVapiFetch(userId);
  const baseUrl = "https://api.vapi.ai"; // Vapi API base URL
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  return vapiFetch(url, options);
}

/**
 * Clear token cache for a user
 */
export function clearVapiTokenCache(userId: string): void {
  tokenCache.delete(userId);
}
