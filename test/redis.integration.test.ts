import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { RedisService } from "../src/api/redis.service";
import Redis from "ioredis";

describe("RedisService Integration", () => {
  let redisService: RedisService;
  let testRedis: Redis;

  beforeAll(async () => {
    // Create a test Redis instance
    testRedis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await testRedis.flushall(); // Clear any existing data
  });

  afterAll(async () => {
    await testRedis.quit();
  });

  beforeEach(() => {
    redisService = RedisService.getInstance();
  });

  it("should store and retrieve data", async () => {
    const testData = { foo: "bar" };
    await redisService.set("test-key", testData);
    const result = await redisService.get("test-key");
    expect(result).toEqual(testData);
  });

  it("should respect TTL", async () => {
    const testData = { foo: "bar" };
    await redisService.set("ttl-test", testData, 1); // 1 second TTL
    const result1 = await redisService.get("ttl-test");
    expect(result1).toEqual(testData);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result2 = await redisService.get("ttl-test");
    expect(result2).toBeNull();
  });

  it("should handle concurrent operations", async () => {
    const promises = Array(10)
      .fill(null)
      .map(async (_, i) => {
        const data = { index: i };
        await redisService.set(`concurrent-${i}`, data);
        return redisService.get(`concurrent-${i}`);
      });

    const results = await Promise.all(promises);
    results.forEach((result, i) => {
      expect(result).toEqual({ index: i });
    });
  });
});
