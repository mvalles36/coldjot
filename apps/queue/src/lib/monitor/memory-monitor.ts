import { logger } from "../log/logger";

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly warningThreshold = 0.8; // 80% of max heap
  private readonly criticalThreshold = 0.9; // 90% of max heap

  private constructor() {}

  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  public startMonitoring(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);
  }

  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private checkMemoryUsage(): void {
    const used = process.memoryUsage();
    const heapUsed = used.heapUsed / 1024 / 1024;
    const heapTotal = used.heapTotal / 1024 / 1024;
    const rss = used.rss / 1024 / 1024;
    const external = used.external / 1024 / 1024;

    logger.info(
      {
        heapUsed: `${Math.round(heapUsed)}MB`,
        heapTotal: `${Math.round(heapTotal)}MB`,
        rss: `${Math.round(rss)}MB`,
        external: `${Math.round(external)}MB`,
      },
      "📊 Memory Usage"
    );

    const heapUsedPercentage = heapUsed / heapTotal;

    if (heapUsedPercentage > this.criticalThreshold) {
      logger.error(
        "🚨 Critical memory usage detected! Initiating garbage collection..."
      );
      if (global.gc) {
        global.gc();
      }
    } else if (heapUsedPercentage > this.warningThreshold) {
      logger.warn("⚠️ High memory usage detected");
    }
  }
}

export const memoryMonitor = MemoryMonitor.getInstance();
