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
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("RateLimitError");
      expect(error.message).toBe("test");
      expect(error.waitTime).toBe(1000);
      expect(error.currentRequests).toBe(5);
      expect(error.maxRequests).toBe(10);
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
          expect(error.waitTime).toBeGreaterThan(0);
          expect(error.waitTime).toBeLessThanOrEqual(config.timeWindow);
          expect(error.currentRequests).toBe(2);
          expect(error.maxRequests).toBe(config.maxRequests);
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
          expect(error.currentRequests).toBe(2);
        }
      }
    });
  });
});
