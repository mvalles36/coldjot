import { logger } from "@/lib/log";
import { REDIS_KEYS, RATE_LIMIT_TYPES, type RateLimitType } from "@/config";
import { RedisConnection } from "@/services/shared/redis/connection";

interface RateLimitInfo {
  allowed: boolean;
  current?: number;
  limit?: number;
  cooldown?: {
    type?: string;
    remaining?: number;
  };
}

export class RateLimitService {
  private static instance: RateLimitService;
  private redis = RedisConnection.getInstance().getClient();

  // Default limits - could be moved to config
  private readonly DEFAULT_RATE_LIMIT = 100;
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds

  private constructor() {}

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  private getKey(
    userId: string,
    type: RateLimitType,
    entityId?: string
  ): string {
    switch (type) {
      case "USER":
        return REDIS_KEYS.rateLimits.user(userId);
      case "SEQUENCE":
        if (!entityId)
          throw new Error("Sequence ID required for sequence rate limit");
        return REDIS_KEYS.rateLimits.sequence(userId, entityId);
      case "CONTACT":
        if (!entityId)
          throw new Error("Contact ID required for contact rate limit");
        return REDIS_KEYS.rateLimits.contact(userId, "", entityId);
      case "COOLDOWN":
        if (!entityId) throw new Error("Entity ID required for cooldown");
        return REDIS_KEYS.rateLimits.cooldown(userId, "", entityId);
      default:
        throw new Error(`Invalid rate limit type: ${type}`);
    }
  }

  async checkRateLimit(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): Promise<RateLimitInfo> {
    try {
      // Pipeline our Redis commands for better performance
      const pipeline = this.redis.pipeline();

      // Add commands to pipeline
      if (contactId) {
        pipeline.get(this.getKey(userId, "CONTACT", contactId));
        pipeline.get(this.getKey(userId, "COOLDOWN", contactId));
      }
      if (sequenceId) {
        pipeline.get(this.getKey(userId, "SEQUENCE", sequenceId));
      }
      pipeline.get(this.getKey(userId, "USER", userId));

      // Execute pipeline
      const results = await pipeline.exec();

      if (!results) {
        logger.error("Failed to execute rate limit pipeline");
        return { allowed: true }; // Fail open
      }

      // Check cooldown first if it exists
      if (contactId && results[1]?.[1]) {
        return {
          allowed: false,
          cooldown: {
            type: "cooldown",
            remaining: parseInt(results[1][1] as string),
          },
        };
      }

      // Check all counters
      const counters = results
        .filter((r) => r?.[1])
        .map((r) => parseInt(r[1] as string));

      const maxCount = Math.max(...counters, 0);

      return {
        allowed: maxCount < this.DEFAULT_RATE_LIMIT,
        current: maxCount,
        limit: this.DEFAULT_RATE_LIMIT,
      };
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
      const pipeline = this.redis.pipeline();

      // Increment all relevant counters
      if (contactId) {
        const contactKey = this.getKey(userId, "CONTACT", contactId);
        pipeline.incr(contactKey);
        pipeline.expire(contactKey, this.DEFAULT_TTL);
      }
      if (sequenceId) {
        const sequenceKey = this.getKey(userId, "SEQUENCE", sequenceId);
        pipeline.incr(sequenceKey);
        pipeline.expire(sequenceKey, this.DEFAULT_TTL);
      }
      const userKey = this.getKey(userId, "USER", userId);
      pipeline.incr(userKey);
      pipeline.expire(userKey, this.DEFAULT_TTL);

      await pipeline.exec();
    } catch (error) {
      logger.error("Failed to increment rate limit counters:", error);
    }
  }

  async addCooldown(
    userId: string,
    entityId: string,
    duration: number
  ): Promise<void> {
    try {
      const key = this.getKey(userId, "COOLDOWN", entityId);
      await this.redis.set(key, duration, "PX", duration);
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
      const pipeline = this.redis.pipeline();

      // Delete all relevant keys
      pipeline.del(this.getKey(userId, "USER", userId));
      if (sequenceId) {
        pipeline.del(this.getKey(userId, "SEQUENCE", sequenceId));
      }
      if (contactId) {
        pipeline.del(this.getKey(userId, "CONTACT", contactId));
        pipeline.del(this.getKey(userId, "COOLDOWN", contactId));
      }

      await pipeline.exec();
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
    cooldowns: { [key: string]: number };
  }> {
    try {
      const pipeline = this.redis.pipeline();

      // Get all relevant counters
      pipeline.get(this.getKey(userId, "USER", userId));
      if (sequenceId) {
        pipeline.get(this.getKey(userId, "SEQUENCE", sequenceId));
      }
      if (contactId) {
        pipeline.get(this.getKey(userId, "CONTACT", contactId));
        pipeline.get(this.getKey(userId, "COOLDOWN", contactId));
      }

      const results = await pipeline.exec();
      if (!results) {
        throw new Error("Failed to get rate limits");
      }

      const counters = results
        .filter((r) => r?.[1])
        .map((r) => parseInt(r[1] as string));

      return {
        current: Math.max(...counters, 0),
        limit: this.DEFAULT_RATE_LIMIT,
        cooldowns:
          contactId && results[3]?.[1]
            ? {
                [contactId]: parseInt(results[3][1] as string),
              }
            : {},
      };
    } catch (error) {
      logger.error("Failed to get rate limits:", error);
      return {
        current: 0,
        limit: this.DEFAULT_RATE_LIMIT,
        cooldowns: {},
      };
    }
  }
}

// Export singleton instance
export const rateLimitService = RateLimitService.getInstance();
