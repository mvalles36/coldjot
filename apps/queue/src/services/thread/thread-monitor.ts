import { threadProcessor } from "./thread-processor";
import { logger } from "@/lib/log";

class EmailThreadMonitor {
  private isRunning: boolean = false;

  constructor() {}

  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Email thread monitor is already running");
      return;
    }

    try {
      await threadProcessor.initializeThreadChecks();
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
      await threadProcessor.close();
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
