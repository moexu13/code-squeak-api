import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RedisService } from "../src/api/redis.service";
import Redis from "ioredis";

// Mock ioredis
vi.mock("ioredis", () => {
  const Redis = vi.fn();
  Redis.prototype.get = vi.fn();
  Redis.prototype.set = vi.fn();
  Redis.prototype.setex = vi.fn();
  Redis.prototype.del = vi.fn();
  Redis.prototype.flushall = vi.fn();
  Redis.prototype.on = vi.fn();
  return { default: Redis };
});

describe("RedisService", () => {
  let redisService: RedisService;
  let mockRedis: any;

  beforeEach(() => {
    // Clear all instances and mocks
    RedisService["instance"] = undefined;
    vi.clearAllMocks();

    // Create new instance
    redisService = RedisService.getInstance();
    mockRedis = vi.mocked(Redis).mock.results[0].value;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("singleton pattern", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = RedisService.getInstance();
      const instance2 = RedisService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("connection", () => {
    it("should create Redis client with correct URL", () => {
      expect(Redis).toHaveBeenCalledWith("redis://localhost:6379", expect.any(Object));
    });

    it("should use REDIS_URL from environment if set", () => {
      process.env.REDIS_URL = "redis://custom:6379";
      RedisService["instance"] = undefined;
      RedisService.getInstance();
      expect(Redis).toHaveBeenCalledWith("redis://custom:6379", expect.any(Object));
    });
  });

  describe("get", () => {
    it("should return null for non-existent key", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      const result = await redisService.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should return parsed JSON for existing key", async () => {
      const testData = {
        title: "Add user authentication",
        body: "Implement JWT-based authentication system",
        user: "devuser",
        state: "open",
        url: "https://github.com/org/repo/pull/123",
        diff: "@@ -1,2 +1,3 @@\n+import jwt from 'jsonwebtoken';\n",
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(testData));
      const result = await redisService.get("test");
      expect(result).toEqual(testData);
    });

    it("should handle JSON parse errors", async () => {
      mockRedis.get.mockResolvedValueOnce("invalid json");
      const result = await redisService.get("test");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("should set value without TTL", async () => {
      const testData = {
        title: "Fix login button styling",
        body: "Update CSS for better mobile responsiveness",
        user: "designer",
        state: "closed",
        url: "https://github.com/org/repo/pull/124",
        diff: "@@ -1,2 +1,3 @@\n+.login-button { padding: 10px; }\n",
      };
      await redisService.set("test", testData);
      expect(mockRedis.set).toHaveBeenCalledWith("test", JSON.stringify(testData));
    });

    it("should set value with TTL", async () => {
      const testData = {
        title: "Update dependencies",
        body: "Bump package versions to latest",
        user: "maintainer",
        state: "open",
        url: "https://github.com/org/repo/pull/125",
        diff: '@@ -1,2 +1,3 @@\n-  "version": "1.0.0"\n+  "version": "1.1.0"\n',
      };
      await redisService.set("test", testData, 60);
      expect(mockRedis.setex).toHaveBeenCalledWith("test", 60, JSON.stringify(testData));
    });
  });

  describe("delete", () => {
    it("should delete key", async () => {
      await redisService.delete("test");
      expect(mockRedis.del).toHaveBeenCalledWith("test");
    });
  });

  describe("clear", () => {
    it("should clear all keys", async () => {
      await redisService.clear();
      expect(mockRedis.flushall).toHaveBeenCalled();
    });
  });
});
