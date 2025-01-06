import { env } from "@/env";
import type { BusinessHours } from "@coldjot/types";

const QUEUE_API_URL = env.QUEUE_API_URL || "http://localhost:3001/api";

export class QueueApiClient {
  private baseUrl: string;

  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_QUEUE_API_URL ||
      "http://localhost:3001"
  ) {
    this.baseUrl = baseUrl.endsWith("/api") ? baseUrl.slice(0, -4) : baseUrl;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;
    console.log("Fetching URL:", url);
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

    return response.json();
  }

  async launchSequence(sequenceId: string, userId: string, testMode = false) {
    console.log("launchSequence", sequenceId, userId, testMode);
    return this.fetchApi(`/sequences/${sequenceId}/launch`, {
      method: "POST",
      body: JSON.stringify({ userId, testMode }),
    });
  }

  async pauseSequence(sequenceId: string, userId: string) {
    return this.fetchApi(`/sequences/${sequenceId}/pause`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  async resumeSequence(sequenceId: string, userId: string) {
    return this.fetchApi(`/sequences/${sequenceId}/resume`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }

  async getSequenceHealth(sequenceId: string) {
    return this.fetchApi(`/sequences/${sequenceId}/health`);
  }

  async getJobStatus(jobId: string, type?: string) {
    const queryParams = type ? `?type=${type}` : "";
    return this.fetchApi(`/jobs/${jobId}${queryParams}`);
  }

  async getSystemMetrics() {
    return this.fetchApi("/metrics");
  }

  async resetSequence(sequenceId: string, userId: string): Promise<any> {
    return this.fetchApi(`/sequences/${sequenceId}/reset`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  }
}

// Export singleton instance
export const queueApi = new QueueApiClient();
