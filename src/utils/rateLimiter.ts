import { redisClient } from "./redis";
import logger from "./logger";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests allowed in the window
  keyPrefix: string; // Prefix for Redis keys
}

export class RateLimiter {
  private static instances: Map<string, RateLimiter> = new Map();
  private config: RateLimitConfig;

  private constructor(config: RateLimitConfig) {
    this.config = config;
  }

  public static getInstance(config: RateLimitConfig): RateLimiter {
    const key = `${config.keyPrefix}:${config.windowMs}:${config.maxRequests}`;
    if (!RateLimiter.instances.has(key)) {
      RateLimiter.instances.set(key, new RateLimiter(config));
    }
    return RateLimiter.instances.get(key)!;
  }

  public async checkLimit(key: string): Promise<{
    remaining: number;
    reset: number;
  }> {
    const redis = redisClient.getClient();
    const now = Date.now();
    const windowKey = `${this.config.keyPrefix}:${key}:${Math.floor(
      now / this.config.windowMs
    )}`;

    try {
      // Increment the counter for this window
      const count = await redis.incr(windowKey);

      // Set expiration if this is the first request in the window
      if (count === 1) {
        await redis.expire(windowKey, Math.ceil(this.config.windowMs / 1000));
      }

      // Calculate remaining requests and reset time
      const remaining = Math.max(0, this.config.maxRequests - count);
      const reset =
        Math.ceil(now / this.config.windowMs) * this.config.windowMs;

      return { remaining, reset };
    } catch (error) {
      logger.error({
        message: "Rate limiter error",
        error: error instanceof Error ? error : new Error(String(error)),
        key,
      });
      // If Redis fails, allow the request to proceed
      return { remaining: 1, reset: now + this.config.windowMs };
    }
  }
}

// Default GitHub API rate limit configuration
// GitHub's rate limit is 5000 requests per hour for authenticated requests
export const githubRateLimiter = RateLimiter.getInstance({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5000, // 5000 requests per hour
  keyPrefix: "github:ratelimit",
});
