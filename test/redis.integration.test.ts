import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { RedisService } from "../src/api/services/redis/service";
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
    const testData = {
      title: "Implement rate limiting",
      body: "Add Redis-based rate limiting middleware",
      user: "backend-dev",
      state: "open",
      url: "https://github.com/org/repo/pull/126",
      diff: "@@ -1,2 +1,3 @@\n+const rateLimiter = new RateLimiter(redis);\n",
    };
    await redisService.set("test-key", testData);
    const result = await redisService.get("test-key");
    expect(result).toEqual(testData);
  });

  it("should respect TTL", async () => {
    const testData = {
      title: "Add API documentation",
      body: "Update OpenAPI specs for new endpoints",
      user: "tech-writer",
      state: "open",
      url: "https://github.com/org/repo/pull/127",
      diff: "@@ -1,2 +1,3 @@\n+  /api/v1/users:\n",
    };
    await redisService.set("ttl-test", testData, 1);
    const result1 = await redisService.get("ttl-test");
    expect(result1).toEqual(testData);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result2 = await redisService.get("ttl-test");
    expect(result2).toBeNull();
  });

  it("should handle concurrent operations", async () => {
    const promises = Array(10)
      .fill(null)
      .map(async (_, i) => {
        const data = {
          title: `PR ${i}`,
          body: `Description for PR ${i}`,
          user: `user${i}`,
          state: i % 2 === 0 ? "open" : "closed",
          url: `https://github.com/org/repo/pull/${i}`,
          diff: `@@ -1,2 +1,3 @@\n+change ${i}\n`,
        };
        await redisService.set(`concurrent-${i}`, data);
        return redisService.get(`concurrent-${i}`);
      });

    const results = await Promise.all(promises);
    results.forEach((result, i) => {
      expect(result).toEqual({
        title: `PR ${i}`,
        body: `Description for PR ${i}`,
        user: `user${i}`,
        state: i % 2 === 0 ? "open" : "closed",
        url: `https://github.com/org/repo/pull/${i}`,
        diff: `@@ -1,2 +1,3 @@\n+change ${i}\n`,
      });
    });
  });
});
