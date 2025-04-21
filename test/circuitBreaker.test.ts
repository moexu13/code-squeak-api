import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker } from "../src/utils/circuitBreaker";

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  const mockSuccessFn = vi.fn().mockResolvedValue("success");
  const mockErrorFn = vi.fn().mockRejectedValue(new Error("test error"));

  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = new CircuitBreaker(3, 5000); // 3 failures, 5s reset
    mockSuccessFn.mockClear();
    mockErrorFn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should execute successful operations normally", async () => {
    const result = await circuitBreaker.execute(mockSuccessFn);
    expect(result).toBe("success");
    expect(mockSuccessFn).toHaveBeenCalledTimes(1);
  });

  it("should track failures and open the circuit after threshold", async () => {
    // First 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(circuitBreaker.execute(mockErrorFn)).rejects.toThrow("test error");
    }

    // Circuit should be open now
    await expect(circuitBreaker.execute(mockSuccessFn)).rejects.toThrow("Circuit breaker is open");
    expect(mockSuccessFn).not.toHaveBeenCalled();
  });

  it("should allow half-open state after reset timeout", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(circuitBreaker.execute(mockErrorFn)).rejects.toThrow("test error");
    }

    // Advance time past reset timeout
    vi.advanceTimersByTime(5000);

    // First request in half-open state should be allowed
    await expect(circuitBreaker.execute(mockSuccessFn)).resolves.toBe("success");
    expect(mockSuccessFn).toHaveBeenCalledTimes(1);

    // Circuit should be closed again after successful request
    await expect(circuitBreaker.execute(mockSuccessFn)).resolves.toBe("success");
    expect(mockSuccessFn).toHaveBeenCalledTimes(2);
  });

  it("should re-open circuit if half-open request fails", async () => {
    // Open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(circuitBreaker.execute(mockErrorFn)).rejects.toThrow("test error");
    }

    // Advance time past reset timeout
    vi.advanceTimersByTime(5000);

    // First request in half-open state fails
    await expect(circuitBreaker.execute(mockErrorFn)).rejects.toThrow("test error");

    // Circuit should be open again
    await expect(circuitBreaker.execute(mockSuccessFn)).rejects.toThrow("Circuit breaker is open");
    expect(mockSuccessFn).not.toHaveBeenCalled();
  });

  it("should reset failure count after successful request", async () => {
    // Two failures
    for (let i = 0; i < 2; i++) {
      await expect(circuitBreaker.execute(mockErrorFn)).rejects.toThrow("test error");
    }

    // One success
    await expect(circuitBreaker.execute(mockSuccessFn)).resolves.toBe("success");

    // Two more failures should not open the circuit
    for (let i = 0; i < 2; i++) {
      await expect(circuitBreaker.execute(mockErrorFn)).rejects.toThrow("test error");
    }

    // Circuit should still be closed
    await expect(circuitBreaker.execute(mockSuccessFn)).resolves.toBe("success");
    expect(mockSuccessFn).toHaveBeenCalledTimes(2);
  });
});
