import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CircuitBreaker } from "../src/utils/circuitBreaker";

describe("CircuitBreaker", () => {
  const config = {
    failureThreshold: 3,
    resetTimeout: 1000, // 1 second for testing
    halfOpenTimeout: 500,
    successThreshold: 2,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should execute successful calls when circuit is closed", async () => {
    const breaker = new CircuitBreaker(config);
    const successFn = vi.fn().mockResolvedValue("success");

    const result = await breaker.execute(successFn);
    expect(result).toBe("success");
    expect(successFn).toHaveBeenCalledTimes(1);
  });

  it("should open circuit after failure threshold is reached", async () => {
    const breaker = new CircuitBreaker(config);
    const failingFn = vi.fn().mockRejectedValue(new Error("API Error"));

    // First 3 calls should fail
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow("API Error");
    }

    // Fourth call should fail fast with circuit open error
    await expect(breaker.execute(failingFn)).rejects.toThrow(
      "Circuit breaker is open"
    );
    expect(failingFn).toHaveBeenCalledTimes(3);
  });

  it("should transition to half-open state after reset timeout", async () => {
    const breaker = new CircuitBreaker(config);
    const failingFn = vi.fn().mockRejectedValue(new Error("API Error"));
    const successFn = vi.fn().mockResolvedValue("success");

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow("API Error");
    }

    // Advance time past reset timeout
    vi.advanceTimersByTime(config.resetTimeout + 100);

    // Should be in half-open state and allow the call
    await expect(breaker.execute(successFn)).resolves.toBe("success");
  });

  it("should close circuit after success threshold in half-open state", async () => {
    const breaker = new CircuitBreaker(config);
    const failingFn = vi.fn().mockRejectedValue(new Error("API Error"));
    const successFn = vi.fn().mockResolvedValue("success");

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow("API Error");
    }

    // Advance time past reset timeout
    vi.advanceTimersByTime(config.resetTimeout + 100);

    // Get required number of successes
    for (let i = 0; i < config.successThreshold; i++) {
      await expect(breaker.execute(successFn)).resolves.toBe("success");
    }

    // Circuit should be closed and allow normal operation
    await expect(breaker.execute(successFn)).resolves.toBe("success");
    expect(successFn).toHaveBeenCalledTimes(config.successThreshold + 1);
  });

  it("should reset failure count on successful call in closed state", async () => {
    const breaker = new CircuitBreaker(config);
    const failingFn = vi.fn().mockRejectedValue(new Error("API Error"));
    const successFn = vi.fn().mockResolvedValue("success");

    // Two failures
    await expect(breaker.execute(failingFn)).rejects.toThrow("API Error");
    await expect(breaker.execute(failingFn)).rejects.toThrow("API Error");

    // One success
    await expect(breaker.execute(successFn)).resolves.toBe("success");

    // Two more failures shouldn't open the circuit
    await expect(breaker.execute(failingFn)).rejects.toThrow("API Error");
    await expect(breaker.execute(failingFn)).rejects.toThrow("API Error");

    // Circuit should still be closed
    await expect(breaker.execute(successFn)).resolves.toBe("success");
  });
});
