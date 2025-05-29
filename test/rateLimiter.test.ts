import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { RateLimiter } from "../src/utils/rateLimiter";
import { redisClient } from "../src/utils/redis";

describe("Rate Limiter", () => {
  const testConfig = {
    windowMs: 1000, // 1 second window for testing
    maxRequests: 3, // 3 requests per second
    keyPrefix: "test:ratelimit",
  };

  let rateLimiter: RateLimiter;

  beforeAll(async () => {
    await redisClient.connect();
    rateLimiter = RateLimiter.getInstance(testConfig);
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Clean up Redis keys before each test
    const redis = redisClient.getClient();
    const keys = await redis.keys(`${testConfig.keyPrefix}:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  });

  it("should allow requests within the limit", async () => {
    const key = "test-key";
    const results = await Promise.all([
      rateLimiter.checkLimit(key),
      rateLimiter.checkLimit(key),
      rateLimiter.checkLimit(key),
    ]);

    expect(results[0].remaining).toBe(2);
    expect(results[1].remaining).toBe(1);
    expect(results[2].remaining).toBe(0);
  });

  it("should reset after the window expires", async () => {
    const key = "test-key";
    const result1 = await rateLimiter.checkLimit(key);
    expect(result1.remaining).toBe(2);

    // Wait for the window to expire
    await new Promise((resolve) =>
      setTimeout(resolve, testConfig.windowMs + 100)
    );

    const result2 = await rateLimiter.checkLimit(key);
    expect(result2.remaining).toBe(2);
  });

  it("should handle different keys independently", async () => {
    const key1 = "test-key-1";
    const key2 = "test-key-2";

    const result1 = await rateLimiter.checkLimit(key1);
    const result2 = await rateLimiter.checkLimit(key2);

    expect(result1.remaining).toBe(2);
    expect(result2.remaining).toBe(2);
  });

  it("should handle Redis errors gracefully", async () => {
    // Temporarily disconnect Redis to simulate an error
    await redisClient.disconnect();

    const key = "test-key";
    const result = await rateLimiter.checkLimit(key);

    // Should allow the request when Redis is down
    expect(result.remaining).toBe(1);

    // Reconnect Redis for other tests
    await redisClient.connect();
  });
});
