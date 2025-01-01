import { logger } from "@/lib/log";
import { REDIS_KEYS } from "@/config";
import { RedisConnection } from "@/services/shared/redis/connection";

export class RateLimitService {
  private static instance: RateLimitService;
  private redis = RedisConnection.getInstance().getClient();

  // constructor() {}

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  private getKey(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): string {
    if (contactId && sequenceId) {
      return REDIS_KEYS.rateLimits.contact(userId, sequenceId, contactId);
    }
    if (sequenceId) {
      return REDIS_KEYS.rateLimits.sequence(userId, sequenceId);
    }
    return REDIS_KEYS.rateLimits.user(userId);
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

  async getLimits(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): Promise<{
    current: number;
    limit: number;
    cooldowns: { error?: number; bounce?: number };
  }> {
    try {
      const key = this.getKey(userId, sequenceId, contactId);
      const count = await this.redis.get(key);
      const errorCooldown = await this.redis.get(
        this.getCooldownKey(userId, "error")
      );
      const bounceCooldown = await this.redis.get(
        this.getCooldownKey(userId, "bounce")
      );

      return {
        current: count ? parseInt(count) : 0,
        limit: 100, // TODO: Make configurable
        cooldowns: {
          error: errorCooldown ? parseInt(errorCooldown) : undefined,
          bounce: bounceCooldown ? parseInt(bounceCooldown) : undefined,
        },
      };
    } catch (error) {
      logger.error("Failed to get rate limits:", error);
      return {
        current: 0,
        limit: 100,
        cooldowns: {},
      };
    }
  }
}

// Export singleton instance
export const rateLimitService = RateLimitService.getInstance();
