import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimiter, RateLimitError } from "../src/utils/rateLimiter";

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter;
  const config = {
    maxRequests: 2,
    timeWindow: 100, // 100ms window
  };

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new RateLimiter(config);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("RateLimitError", () => {
    it("should create error with correct properties", () => {
      const error = new RateLimitError("test", 1000, 5, 10);
      expect(error.name).toBe("RateLimitError");
      expect(error.message).toBe("test");
      expect(error.waitTimeMs).toBe(1000);
      expect(error.currentRequestCount).toBe(5);
      expect(error.maxRequestLimit).toBe(10);
    });

    it("should throw error for invalid waitTimeMs", () => {
      expect(() => new RateLimitError("test", -1, 5, 10)).toThrow(
        "waitTimeMs must be a non-negative number"
      );
      expect(() => new RateLimitError("test", "1000" as any, 5, 10)).toThrow(
        "waitTimeMs must be a non-negative number"
      );
    });

    it("should throw error for invalid currentRequestCount", () => {
      expect(() => new RateLimitError("test", 1000, -1, 10)).toThrow(
        "currentRequestCount must be a non-negative number"
      );
      expect(() => new RateLimitError("test", 1000, "5" as any, 10)).toThrow(
        "currentRequestCount must be a non-negative number"
      );
    });

    it("should throw error for invalid maxRequestLimit", () => {
      expect(() => new RateLimitError("test", 1000, 5, 0)).toThrow(
        "maxRequestLimit must be a positive number"
      );
      expect(() => new RateLimitError("test", 1000, 5, -1)).toThrow(
        "maxRequestLimit must be a positive number"
      );
      expect(() => new RateLimitError("test", 1000, 5, "10" as any)).toThrow(
        "maxRequestLimit must be a positive number"
      );
    });
  });

  describe("RateLimiter constructor", () => {
    it("should throw error for invalid config", () => {
      expect(() => new RateLimiter(null as any)).toThrow("RateLimitConfig must be an object");
      expect(() => new RateLimiter(undefined as any)).toThrow("RateLimitConfig must be an object");
    });

    it("should throw error for invalid maxRequests", () => {
      expect(() => new RateLimiter({ maxRequests: 0, timeWindow: 100 })).toThrow(
        "maxRequests must be a positive number"
      );
      expect(() => new RateLimiter({ maxRequests: -1, timeWindow: 100 })).toThrow(
        "maxRequests must be a positive number"
      );
      expect(() => new RateLimiter({ maxRequests: "2" as any, timeWindow: 100 })).toThrow(
        "maxRequests must be a positive number"
      );
    });

    it("should throw error for invalid timeWindow", () => {
      expect(() => new RateLimiter({ maxRequests: 2, timeWindow: 0 })).toThrow(
        "timeWindow must be a positive number"
      );
      expect(() => new RateLimiter({ maxRequests: 2, timeWindow: -1 })).toThrow(
        "timeWindow must be a positive number"
      );
      expect(() => new RateLimiter({ maxRequests: 2, timeWindow: "100" as any })).toThrow(
        "timeWindow must be a positive number"
      );
    });
  });

  describe("waitForSlot", () => {
    it("should allow requests within limit", async () => {
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();
      // Should not throw
    });

    it("should throw RateLimitError when limit exceeded", async () => {
      // Fill up the rate limit
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();

      // Try to exceed the limit
      await expect(rateLimiter.waitForSlot()).rejects.toThrow(RateLimitError);
    });

    it("should include correct wait time in error", async () => {
      // Fill up the rate limit
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();

      try {
        await rateLimiter.waitForSlot();
      } catch (error) {
        if (error instanceof RateLimitError) {
          expect(error.waitTimeMs).toBeGreaterThan(0);
          expect(error.waitTimeMs).toBeLessThanOrEqual(config.timeWindow);
          expect(error.currentRequestCount).toBe(2);
          expect(error.maxRequestLimit).toBe(config.maxRequests);
        }
      }
    });

    it("should allow requests after time window", async () => {
      // Fill up the rate limit
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();

      // Try to exceed the limit
      await expect(rateLimiter.waitForSlot()).rejects.toThrow(RateLimitError);

      // Advance time past the window
      vi.advanceTimersByTime(config.timeWindow);

      // Should now succeed
      await rateLimiter.waitForSlot();
    });

    it("should track error count correctly", async () => {
      // Fill up the rate limit
      await rateLimiter.waitForSlot();
      await rateLimiter.waitForSlot();

      // Trigger multiple errors
      for (let i = 0; i < 3; i++) {
        try {
          await rateLimiter.waitForSlot();
        } catch (error) {
          expect(error).toBeInstanceOf(RateLimitError);
        }
        vi.advanceTimersByTime(10);
      }

      // Advance time past error window
      vi.advanceTimersByTime(1000);

      // Should have reset error count
      try {
        await rateLimiter.waitForSlot();
      } catch (error) {
        if (error instanceof RateLimitError) {
          expect(error.currentRequestCount).toBe(2);
        }
      }
    });
  });
});
