import { EmailThreadProcessor } from "./thread-processor";
import { logger } from "../log/logger";

class EmailThreadMonitor {
  private emailThreadProcessor: EmailThreadProcessor | undefined;
  private isRunning: boolean = false;

  constructor() {
    this.emailThreadProcessor = undefined;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Email thread monitor is already running");
      return;
    }

    try {
      this.emailThreadProcessor = new EmailThreadProcessor();
      await this.emailThreadProcessor.initializeThreadChecks();
      this.isRunning = true;
      logger.info("✓ Email thread monitor started");
    } catch (error) {
      logger.error("❌ Failed to start email thread monitor:", error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.emailThreadProcessor?.close();
      this.isRunning = false;
      logger.info("✓ Email thread monitor stopped");
    } catch (error) {
      logger.error("❌ Failed to stop email thread monitor:", error);
      throw error;
    }
  }

  public isActive(): boolean {
    return this.isRunning;
  }
}

// Create singleton instance
export const emailThreadMonitor = new EmailThreadMonitor();
