interface RateLimiterOptions {
  maxPerSecond: number;
  maxPerMinute: number;
}

export class RateLimiter {
  private readonly maxPerSecond: number;
  private readonly maxPerMinute: number;
  private secondWindow: number = 0;
  private minuteWindow: number = 0;
  private secondCount: number = 0;
  private minuteCount: number = 0;

  constructor(options: RateLimiterOptions) {
    this.maxPerSecond = options.maxPerSecond;
    this.maxPerMinute = options.maxPerMinute;
    this.resetCounters();
  }

  private resetCounters() {
    const now = Date.now();
    this.secondWindow = Math.floor(now / 1000);
    this.minuteWindow = Math.floor(now / 60000);
    this.secondCount = 0;
    this.minuteCount = 0;
  }

  private updateCounters() {
    const now = Date.now();
    const currentSecond = Math.floor(now / 1000);
    const currentMinute = Math.floor(now / 60000);

    if (currentSecond > this.secondWindow) {
      this.secondWindow = currentSecond;
      this.secondCount = 0;
    }

    if (currentMinute > this.minuteWindow) {
      this.minuteWindow = currentMinute;
      this.minuteCount = 0;
    }
  }

  async acquire(): Promise<void> {
    this.updateCounters();

    while (
      this.secondCount >= this.maxPerSecond ||
      this.minuteCount >= this.maxPerMinute
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      this.updateCounters();
    }

    this.secondCount++;
    this.minuteCount++;
  }

  release(): void {
    // Optional: Implement if you need to manually release tokens
  }
}
