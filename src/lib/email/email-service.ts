export type EmailStatus = "queued" | "sent" | "failed" | "bounced";

interface SendEmailOptions {
  to: string;
  subject: string;
  content: string;
  sequenceId?: string;
  stepId?: string;
}

interface SendEmailResult {
  status: EmailStatus;
  messageId?: string;
  error?: string;
}

// Mock email service for testing
export class MockEmailService {
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simulate random success/failure (90% success rate)
    const success = Math.random() < 0.9;

    if (success) {
      return {
        status: "sent",
        messageId: `mock_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`,
      };
    } else {
      return {
        status: "failed",
        error: "Mock sending failed",
      };
    }
  }
}

// Singleton instance
export const emailService = new MockEmailService();
