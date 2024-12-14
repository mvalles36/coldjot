import { env } from "@/env";
import type { EmailEventType } from "@mailjot/types";

const QUEUE_API_URL = env.QUEUE_API_URL || "http://localhost:3001/api";

export class TrackingClient {
  private baseUrl: string;

  constructor(baseUrl: string = QUEUE_API_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    console.log("Fetching URL:", url);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(error.error || "Failed to fetch");
      }

      // For GET requests to tracking pixel, return void
      if (options.method === "GET") {
        return;
      }

      return response.json();
    } catch (error) {
      console.error("Error in tracking request:", error);
      throw error;
    }
  }

  /**
   * Record an email open event
   * GET /tracking/opens/:hash
   */
  async recordEmailOpen(
    hash: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.fetchApi(`/tracking/opens/${hash}`, {
      method: "GET",
      headers: metadata
        ? {
            "X-Tracking-Metadata": JSON.stringify(metadata),
          }
        : undefined,
    });
  }

  /**
   * Record a link click event
   * POST /tracking/clicks/:hash
   */
  async recordLinkClick(
    hash: string,
    linkId: string,
    metadata?: Record<string, any>
  ): Promise<{ redirectUrl: string }> {
    return this.fetchApi(`/tracking/clicks/${hash}`, {
      method: "POST",
      body: JSON.stringify({
        linkId,
        ...(metadata ? { metadata } : {}),
      }),
    });
  }

  /**
   * Track a general email event
   * POST /tracking/events
   */
  async trackEmailEvent(data: {
    emailId: string;
    eventType: EmailEventType;
    metadata?: Record<string, any>;
  }): Promise<void> {
    return this.fetchApi(`/tracking/events`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

// Export singleton instance
export const trackingClient = new TrackingClient();
