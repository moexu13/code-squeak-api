import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnalysisWorker } from "../src/workers/analysis.worker";
import { AnalysisQueue } from "../src/api/analysis/analysis.queue";
import type { PRAnalysisParams } from "../src/api/analysis/types/queue";

const mockAnalyzePullRequest = vi.hoisted(() => vi.fn());
const mockNetworkError = vi.hoisted(
  () =>
    class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "NetworkError";
      }
    }
);
const mockTimeoutError = vi.hoisted(
  () =>
    class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "TimeoutError";
      }
    }
);
const mockRateLimitError = vi.hoisted(
  () =>
    class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "RateLimitError";
      }
    }
);

const mockRedisClient = vi.hoisted(() => {
  const jobs = new Map<string, string>();
  const queues = new Map<string, string[]>();

  const client = {
    set: vi.fn().mockImplementation(async (key: string, value: string) => {
      jobs.set(key, value);
    }),
    get: vi.fn().mockImplementation(async (key: string) => {
      return jobs.get(key) || null;
    }),
    del: vi.fn().mockImplementation(async (key: string) => {
      jobs.delete(key);
    }),
    lPush: vi.fn().mockImplementation(async (key: string, value: string) => {
      if (!queues.has(key)) {
        queues.set(key, []);
      }
      queues.get(key)!.push(value);
    }),
    rPop: vi.fn().mockImplementation(async (key: string) => {
      const queue = queues.get(key);
      if (!queue || queue.length === 0) {
        return null;
      }
      return queue.pop() || null;
    }),
    keys: vi.fn().mockImplementation(async (pattern: string) => {
      const prefix = pattern.replace("*", "");
      return Array.from(jobs.keys()).filter((key) => key.startsWith(prefix));
    }),
  };
  return () => client;
});

// Mock dependencies
vi.mock("../src/api/analysis/analysis.service", () => ({
  analyzePullRequest: mockAnalyzePullRequest,
  NetworkError: mockNetworkError,
  TimeoutError: mockTimeoutError,
  RateLimitError: mockRateLimitError,
}));

vi.mock("../src/utils/redis", () => ({
  redisClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getClient: vi.fn().mockReturnValue(mockRedisClient()),
  },
}));

describe("AnalysisWorker", () => {
  let worker: AnalysisWorker;
  let queue: AnalysisQueue;
  const mockParams: PRAnalysisParams = {
    owner: "test-owner",
    repo: "test-repo",
    pull_number: 123,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const client = mockRedisClient();
    client.set.mockClear();
    client.get.mockClear();
    client.lPush.mockClear();
    client.rPop.mockClear();
    client.keys.mockClear();

    worker = new AnalysisWorker();
    // Override retry config for faster tests
    worker["config"].retryConfig = {
      ...worker["config"].retryConfig,
      baseDelay: 100, // 100ms instead of 1s
      maxDelay: 500, // 500ms instead of 30s
      useExponentialBackoff: false, // Use constant delay for predictable timing
    };
    queue = AnalysisQueue.getInstance();
    await worker.start();
  });

  afterEach(async () => {
    await worker.stop();
  });

  it("should process a job successfully", async () => {
    mockAnalyzePullRequest.mockResolvedValueOnce(undefined);

    const addedJob = await queue.addJob(mockParams);
    expect(addedJob.status).toBe("pending");

    // Wait for job to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedJob = await queue.getJob(addedJob.id);
    expect(updatedJob?.status).toBe("completed");
    expect(mockAnalyzePullRequest).toHaveBeenCalledWith(mockParams);
  }, 10000);

  it("should retry a job on network error", async () => {
    mockAnalyzePullRequest
      .mockRejectedValueOnce(new mockNetworkError("Network error"))
      .mockResolvedValueOnce(undefined);

    const addedJob = await queue.addJob(mockParams);
    expect(addedJob.status).toBe("pending");

    // Wait for job to be processed and retried
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const updatedJob = await queue.getJob(addedJob.id);
    expect(updatedJob?.status).toBe("completed");
    expect(updatedJob?.retryCount).toBe(1);
    expect(mockAnalyzePullRequest).toHaveBeenCalledTimes(2);
  }, 10000);

  it("should retry a job on timeout error", async () => {
    mockAnalyzePullRequest
      .mockRejectedValueOnce(new mockTimeoutError("Timeout error"))
      .mockResolvedValueOnce(undefined);

    const addedJob = await queue.addJob(mockParams);
    expect(addedJob.status).toBe("pending");

    // Wait for job to be processed and retried
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const updatedJob = await queue.getJob(addedJob.id);
    expect(updatedJob?.status).toBe("completed");
    expect(updatedJob?.retryCount).toBe(1);
    expect(mockAnalyzePullRequest).toHaveBeenCalledTimes(2);
  }, 10000);

  it("should retry a job on rate limit error", async () => {
    mockAnalyzePullRequest
      .mockRejectedValueOnce(new mockRateLimitError("Rate limit error"))
      .mockResolvedValueOnce(undefined);

    const addedJob = await queue.addJob(mockParams);
    expect(addedJob.status).toBe("pending");

    // Wait for job to be processed and retried
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const updatedJob = await queue.getJob(addedJob.id);
    expect(updatedJob?.status).toBe("completed");
    expect(updatedJob?.retryCount).toBe(1);
    expect(mockAnalyzePullRequest).toHaveBeenCalledTimes(2);
  }, 10000);

  it("should fail a job after max retries", async () => {
    mockAnalyzePullRequest.mockRejectedValue(
      new mockNetworkError("Network error")
    );

    const addedJob = await queue.addJob(mockParams);
    expect(addedJob.status).toBe("pending");

    // Wait for job to be processed and retried
    // Initial + 3 retries = 4 attempts * 100ms delay = 400ms minimum
    // Add buffer for processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedJob = await queue.getJob(addedJob.id);
    expect(updatedJob?.status).toBe("failed");
    expect(updatedJob?.retryCount).toBe(3);
    expect(mockAnalyzePullRequest).toHaveBeenCalledTimes(4); // Initial + 3 retries
  }, 2000);

  it("should not retry non-retryable errors", async () => {
    mockAnalyzePullRequest.mockRejectedValue(new Error("Non-retryable error"));

    const addedJob = await queue.addJob(mockParams);
    expect(addedJob.status).toBe("pending");

    // Wait for job to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedJob = await queue.getJob(addedJob.id);
    expect(updatedJob?.status).toBe("failed");
    expect(updatedJob?.retryCount).toBe(0);
    expect(mockAnalyzePullRequest).toHaveBeenCalledTimes(1);
  }, 10000);

  it("should track retry statistics", async () => {
    mockAnalyzePullRequest
      .mockRejectedValueOnce(new mockNetworkError("Network error"))
      .mockResolvedValueOnce(undefined);

    const addedJob = await queue.addJob(mockParams);
    expect(addedJob.status).toBe("pending");

    // Wait for job to be processed and retried
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const stats = await queue.getStats();
    expect(stats.retrying).toBe(0);
    expect(stats.averageRetries).toBe(1);
  }, 10000);
});
