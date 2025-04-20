import Redis from "ioredis";
import logger from "../utils/logger";

export class RedisService {
  private redis: Redis;
  private static instance: RedisService | undefined;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on("error", (error) => {
      logger.error({ error }, "Redis connection error");
    });

    this.redis.on("connect", () => {
      logger.info("Redis connected successfully");
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return parsed as T;
    } catch (error) {
      logger.error({ error, key }, "Error getting data from Redis");
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      logger.error({ error, key }, "Error setting data in Redis");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error({ error, key }, "Error deleting data from Redis");
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushall();
    } catch (error) {
      logger.error({ error }, "Error clearing Redis cache");
    }
  }
}
