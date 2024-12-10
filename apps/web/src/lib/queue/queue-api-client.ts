import { env } from "@/env";
import type { BusinessHours } from "@mailjot/types";

const QUEUE_API_URL = env.QUEUE_API_URL || "http://localhost:3001/api";

export class QueueApiClient {
  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${QUEUE_API_URL}${endpoint}`, {
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
}

// Export singleton instance
export const queueApi = new QueueApiClient();
