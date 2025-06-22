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

/* ------------------------------------------------------------------
 * AI-Optimised Call Timing
 * ------------------------------------------------------------------
 * Analyses historical engagement (email opens/clicks) for a contact and
 * suggests the next best Date/time to place a call.  The algorithm is
 * intentionally simple and fast:
 *   1. Gather hours-of-day for past engagement events.
 *   2. Pick the hour with the highest frequency.
 *   3. Respect the user's configured BusinessHours (or default 09-17).
 *   4. Produce a Date object in the future that lands on an allowed
 *      workday and within business hours.
 * The function can be evolved later with advanced ML heuristics, but this
 * initial implementation fulfils the requirements and keeps resources
 * minimal.
 * ------------------------------------------------------------------ */

/**
 * Return the next optimised time to call a contact.
 *
 * @param contactId Contact identifier
 * @param userId    Current user identifier (owner of the sequence)
 */
export async function getOptimizedCallTime(
  contactId: string,
  userId: string
): Promise<Date> {
  /* ---------------- Gather engagement events ---------------- */
  const events = await prisma.emailEvent.findMany({
    where: {
      contactId,
      type: { in: ["opened", "clicked"] },
    },
    select: { timestamp: true },
  });

  // Frequency map for each hour of day (0–23)
  const hourBuckets = new Array<number>(24).fill(0);
  for (const e of events) {
    const hour = new Date(e.timestamp).getHours();
    hourBuckets[hour] += 1;
  }

  // Determine most engaged hour or default to 10 AM
  let bestHour = hourBuckets.indexOf(Math.max(...hourBuckets));
  if (bestHour === -1 || hourBuckets[bestHour] === 0) {
    bestHour = 10; // default fallback
  }

  /* ---------------- Respect business hours ---------------- */
  const businessHours = await prisma.businessHours.findFirst({
    where: { userId },
  });

  const workStart = businessHours
    ? parseInt(businessHours.workHoursStart.split(":")[0], 10)
    : 9;
  const workEnd = businessHours
    ? parseInt(businessHours.workHoursEnd.split(":")[0], 10)
    : 17; // exclusive upper bound
  const workDays = businessHours?.workDays ?? [1, 2, 3, 4, 5]; // 1 = Monday

  // Clamp bestHour into working window
  if (bestHour < workStart) bestHour = workStart;
  if (bestHour >= workEnd) bestHour = workStart;

  /* ---------------- Calculate next occurrence ---------------- */
  const now = new Date();
  let candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    bestHour,
    0,
    0,
    0
  );

  // If candidate already passed for today or today is not a workday, roll forward
  const isWorkday = (date: Date) =>
    workDays.includes(((date.getDay() + 6) % 7) + 1); // convert JS 0-6 → 1-7 starting Mon

  while (candidate <= now || !isWorkday(candidate)) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}
