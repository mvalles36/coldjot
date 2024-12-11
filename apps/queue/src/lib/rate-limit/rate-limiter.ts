import Redis from "ioredis";
import { logger } from "@/lib/log/logger";

// Rate limit constants
export const RATE_LIMITS = {
  PER_MINUTE: 60,
  PER_HOUR: 300,
  PER_DAY: 2000,
  PER_SEQUENCE: 1000,
  PER_CONTACT: 10,
  COOLDOWN: {
    BOUNCE: 24 * 60 * 60 * 1000, // 24 hours
    ERROR: 15 * 60 * 1000, // 15 minutes
  },
};

export interface RateLimitInfo {
  userId: string;
  sequenceId?: string;
  contactId?: string;
  counts: {
    minute: number;
    hour: number;
    day: number;
  };
  lastReset: {
    minute: Date;
    hour: Date;
    day: Date;
  };
  cooldowns: Array<{
    type: "bounce" | "error";
    until: number;
  }>;
}

export class RateLimiter {
  private redis: Redis;
  private readonly keyPrefix = "rate-limit:";

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
    });
  }

  private getKeys(userId: string, sequenceId?: string, contactId?: string) {
    const base = `${this.keyPrefix}${userId}`;
    return {
      minute: `${base}:minute`,
      hour: `${base}:hour`,
      day: `${base}:day`,
      sequence: sequenceId ? `${base}:sequence:${sequenceId}` : null,
      contact: contactId ? `${base}:contact:${contactId}` : null,
      cooldown: `${base}:cooldown`,
    };
  }

  async checkRateLimit(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const keys = this.getKeys(userId, sequenceId, contactId);
    const now = Date.now();

    try {
      // Get all current counts
      const [
        minuteCount,
        hourCount,
        dayCount,
        sequenceCount,
        contactCount,
        cooldowns,
      ] = await Promise.all([
        this.redis.get(keys.minute),
        this.redis.get(keys.hour),
        this.redis.get(keys.day),
        keys.sequence ? this.redis.get(keys.sequence) : Promise.resolve("0"),
        keys.contact ? this.redis.get(keys.contact) : Promise.resolve("0"),
        this.redis.lrange(keys.cooldown, 0, -1),
      ]);

      // Check cooldowns
      const activeCooldowns = cooldowns
        .map((c) => JSON.parse(c))
        .filter((c) => c.until > now);

      if (activeCooldowns.length > 0) {
        return {
          allowed: false,
          info: {
            userId,
            sequenceId,
            contactId,
            counts: {
              minute: parseInt(minuteCount || "0"),
              hour: parseInt(hourCount || "0"),
              day: parseInt(dayCount || "0"),
            },
            lastReset: {
              minute: new Date(now - (now % (60 * 1000))),
              hour: new Date(now - (now % (60 * 60 * 1000))),
              day: new Date(now - (now % (24 * 60 * 60 * 1000))),
            },
            cooldowns: activeCooldowns,
          },
        };
      }

      // Check rate limits
      const isAllowed =
        parseInt(minuteCount || "0") < RATE_LIMITS.PER_MINUTE &&
        parseInt(hourCount || "0") < RATE_LIMITS.PER_HOUR &&
        parseInt(dayCount || "0") < RATE_LIMITS.PER_DAY &&
        parseInt(sequenceCount || "0") < RATE_LIMITS.PER_SEQUENCE &&
        parseInt(contactCount || "0") < RATE_LIMITS.PER_CONTACT;

      return {
        allowed: isAllowed,
        info: {
          userId,
          sequenceId,
          contactId,
          counts: {
            minute: parseInt(minuteCount || "0"),
            hour: parseInt(hourCount || "0"),
            day: parseInt(dayCount || "0"),
          },
          lastReset: {
            minute: new Date(now - (now % (60 * 1000))),
            hour: new Date(now - (now % (60 * 60 * 1000))),
            day: new Date(now - (now % (24 * 60 * 60 * 1000))),
          },
          cooldowns: activeCooldowns,
        },
      };
    } catch (error) {
      logger.error("Error checking rate limit:", error);
      // Fail closed - if we can't check the rate limit, don't allow the action
      return {
        allowed: false,
        info: {
          userId,
          sequenceId,
          contactId,
          counts: { minute: 0, hour: 0, day: 0 },
          lastReset: {
            minute: new Date(),
            hour: new Date(),
            day: new Date(),
          },
          cooldowns: [],
        },
      };
    }
  }

  async incrementCounters(
    userId: string,
    sequenceId?: string,
    contactId?: string
  ): Promise<void> {
    const keys = this.getKeys(userId, sequenceId, contactId);
    const pipeline = this.redis.pipeline();

    // Increment counters with appropriate TTLs
    pipeline.incr(keys.minute).expire(keys.minute, 60);
    pipeline.incr(keys.hour).expire(keys.hour, 60 * 60);
    pipeline.incr(keys.day).expire(keys.day, 24 * 60 * 60);

    if (keys.sequence) {
      pipeline.incr(keys.sequence).expire(keys.sequence, 7 * 24 * 60 * 60);
    }
    if (keys.contact) {
      pipeline.incr(keys.contact).expire(keys.contact, 24 * 60 * 60);
    }

    try {
      await pipeline.exec();
    } catch (error) {
      logger.error("Error incrementing rate limit counters:", error);
    }
  }

  async addCooldown(
    userId: string,
    type: "bounce" | "error",
    duration: number
  ): Promise<void> {
    const keys = this.getKeys(userId);
    const cooldown = {
      type,
      until: Date.now() + duration,
    };

    try {
      await this.redis
        .multi()
        .lpush(keys.cooldown, JSON.stringify(cooldown))
        .expire(keys.cooldown, Math.ceil(duration / 1000))
        .exec();
    } catch (error) {
      logger.error("Error adding cooldown:", error);
    }
  }

  async resetLimits(userId: string): Promise<void> {
    const keys = this.getKeys(userId);
    const pipeline = this.redis.pipeline();

    pipeline.del(keys.minute);
    pipeline.del(keys.hour);
    pipeline.del(keys.day);
    pipeline.del(keys.cooldown);

    try {
      await pipeline.exec();
    } catch (error) {
      logger.error("Error resetting rate limits:", error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      logger.error("Error cleaning up rate limiter:", error);
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
