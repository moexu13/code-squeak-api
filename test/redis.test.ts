import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redisClient } from "../src/utils/redis";

describe("Redis Client", () => {
  beforeAll(async () => {
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  it("should connect to Redis", () => {
    expect(redisClient.isReady()).toBe(true);
  });

  it("should set and get a value", async () => {
    const client = redisClient.getClient();
    const testKey = "test:key";
    const testValue = "test-value";

    await client.set(testKey, testValue);
    const value = await client.get(testKey);

    expect(value).toBe(testValue);

    // Cleanup
    await client.del(testKey);
  });

  it("should handle non-existent keys", async () => {
    const client = redisClient.getClient();
    const value = await client.get("non-existent-key");
    expect(value).toBeNull();
  });

  it("should set and get with expiration", async () => {
    const client = redisClient.getClient();
    const testKey = "test:expiring-key";
    const testValue = "expiring-value";

    await client.set(testKey, testValue, { EX: 1 }); // 1 second expiration
    const value = await client.get(testKey);
    expect(value).toBe(testValue);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const expiredValue = await client.get(testKey);
    expect(expiredValue).toBeNull();
  });
});
