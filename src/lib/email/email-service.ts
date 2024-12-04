import { trackEmailEvent } from "./tracking-service";
import { EmailEventType } from "@/types";

export type EmailStatus = "queued" | "sent" | "failed" | "bounced";

interface SendEmailOptions {
  to: string;
  subject: string;
  content: string;
  sequenceId?: string;
  stepId?: string;
  contactId?: string;
}

interface SendEmailResult {
  status: EmailStatus;
  messageId?: string;
  error?: string;
}

// Mock email service for testing
export class MockEmailService {
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate random success/failure (90% success rate)
      const success = Math.random() < 0.9;

      if (success) {
        const messageId = `mock_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;

        // Track the sent event
        if (options.sequenceId) {
          await trackEmailEvent(messageId, options.sequenceId, "sent", {
            messageId,
            contactId: options.contactId,
          });
        }

        return {
          status: "sent",
          messageId,
        };
      } else {
        const failedMessageId = `failed_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;

        // Track bounce event
        if (options.sequenceId) {
          await trackEmailEvent(
            failedMessageId,
            options.sequenceId,
            "bounced",
            {
              bounceReason: "Mock sending failed",
              contactId: options.contactId,
            }
          );
        }

        return {
          status: "failed",
          error: "Mock sending failed",
        };
      }
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }
}

// Singleton instance
export const emailService = new MockEmailService();
