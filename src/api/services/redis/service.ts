import Redis from "ioredis";
import logger from "../../../utils/logger";
import { getRedisConfig } from "./config";
import { handleRedisError } from "./error-handler";

export class RedisService {
  private redis: Redis;
  private static instance: RedisService | undefined;
  private config: ReturnType<typeof getRedisConfig>;

  private constructor() {
    this.config = getRedisConfig();
    this.redis = new Redis(this.config.url, {
      retryStrategy: (times) => {
        const delay = Math.min(
          times * this.config.retryStrategy.initialDelay,
          this.config.retryStrategy.maxDelay
        );
        return delay;
      },
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
    });

    this.redis.on("error", (error) => {
      handleRedisError(error, "Redis connection");
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
      handleRedisError(error, `get(${key})`);
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
      handleRedisError(error, `set(${key})`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      handleRedisError(error, `delete(${key})`);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushall();
    } catch (error) {
      handleRedisError(error, "clear");
    }
  }
}
