import Redis from "ioredis";
import { logger } from "@/lib/log/logger";

export class RateLimiter {
  private redis: Redis;
  private static instance: RateLimiter | null = null;

  private constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    });
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  private getKey(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): string {
    const parts = ["rate-limit", userId];
    if (sequenceId) parts.push(sequenceId);
    if (contactId) parts.push(contactId);
    return parts.join(":");
  }

  private getCooldownKey(userId: string, type: string): string {
    return `cooldown:${userId}:${type}`;
  }

  async checkRateLimit(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): Promise<{ allowed: boolean; info?: any }> {
    try {
      const key = this.getKey(userId, sequenceId, contactId);
      const count = await this.redis.get(key);
      const limit = 100; // Configurable limit

      // Check cooldowns first
      const errorCooldown = await this.redis.get(
        this.getCooldownKey(userId, "error")
      );
      if (errorCooldown) {
        return {
          allowed: false,
          info: { reason: "error_cooldown", remaining: errorCooldown },
        };
      }

      const bounceCooldown = await this.redis.get(
        this.getCooldownKey(userId, "bounce")
      );
      if (bounceCooldown) {
        return {
          allowed: false,
          info: { reason: "bounce_cooldown", remaining: bounceCooldown },
        };
      }

      if (!count) return { allowed: true };
      return { allowed: parseInt(count) < limit };
    } catch (error) {
      logger.error("Rate limit check failed:", error);
      return { allowed: true }; // Fail open
    }
  }

  async incrementCounters(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): Promise<void> {
    try {
      const key = this.getKey(userId, sequenceId, contactId);
      await this.redis.incr(key);
      await this.redis.expire(key, 24 * 60 * 60); // 24 hours TTL
    } catch (error) {
      logger.error("Failed to increment rate limit counters:", error);
    }
  }

  async addCooldown(
    userId: string,
    type: string,
    duration: number
  ): Promise<void> {
    try {
      const key = this.getCooldownKey(userId, type);
      await this.redis.set(key, "1", "PX", duration);
    } catch (error) {
      logger.error("Failed to add cooldown:", error);
    }
  }

  async resetLimits(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): Promise<void> {
    try {
      logger.info(`🔄 Resetting rate limits for user: ${userId}`);

      // Reset counters
      const key = this.getKey(userId, sequenceId, contactId);
      await this.redis.del(key);

      // Reset cooldowns
      await this.redis.del(this.getCooldownKey(userId, "error"));
      await this.redis.del(this.getCooldownKey(userId, "bounce"));

      logger.info(`✓ Rate limits reset for user: ${userId}`);
    } catch (error) {
      logger.error("Failed to reset rate limits:", error);
      throw error;
    }
  }
}

export const rateLimiter = RateLimiter.getInstance();
