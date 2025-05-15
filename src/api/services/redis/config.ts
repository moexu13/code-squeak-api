import { RedisConfig } from "./types";

export const getRedisConfig = (): RedisConfig => ({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  retryStrategy: {
    maxDelay: 2000,
    initialDelay: 50,
  },
  maxRetriesPerRequest: 3,
});
