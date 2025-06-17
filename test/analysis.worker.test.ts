import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnalysisWorker } from "../src/workers/analysis.worker";
import { AnalysisQueue } from "../src/api/analysis/analysis.queue";
import { redisClient } from "../src/utils/redis";

// Mock dependencies
vi.mock("../src/api/analysis/analysis.queue");
vi.mock("../src/utils/redis");
vi.mock("../src/utils/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AnalysisWorker", () => {
  let worker: AnalysisWorker;
  let mockQueue: AnalysisQueue;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup queue mock
    mockQueue = {
      initialize: vi.fn().mockResolvedValue(undefined),
      setWorkerCount: vi.fn(),
      processJobs: vi.fn().mockResolvedValue(undefined),
      stopProcessing: vi.fn(),
      cleanupOldJobs: vi.fn().mockResolvedValue(undefined),
      getQueueStats: vi.fn().mockResolvedValue({}),
    } as unknown as AnalysisQueue;

    (AnalysisQueue.getInstance as any).mockReturnValue(mockQueue);

    // Setup Redis mock
    (redisClient.connect as any).mockResolvedValue(undefined);
    (redisClient.disconnect as any).mockResolvedValue(undefined);

    // Create worker instance
    worker = new AnalysisWorker();
  });

  afterEach(async () => {
    // Ensure worker is stopped
    await worker.stopWorker();
  });

  it("should start worker successfully", async () => {
    await worker.startWorker();

    expect(redisClient.connect).toHaveBeenCalled();
    expect(mockQueue.initialize).toHaveBeenCalled();
    expect(mockQueue.processJobs).toHaveBeenCalled();
  });

  it("should handle worker shutdown gracefully", async () => {
    // Start the worker
    await worker.startWorker();

    // Stop the worker
    await worker.stopWorker();

    // Verify cleanup
    expect(mockQueue.stopProcessing).toHaveBeenCalled();
    expect(redisClient.disconnect).toHaveBeenCalled();
  });

  it("should handle errors during startup", async () => {
    // Mock Redis connection error
    (redisClient.connect as any).mockRejectedValueOnce(
      new Error("Connection failed")
    );

    // Attempt to start worker
    await expect(worker.startWorker()).rejects.toThrow("Connection failed");

    // Verify cleanup
    expect(mockQueue.initialize).not.toHaveBeenCalled();
    expect(mockQueue.processJobs).not.toHaveBeenCalled();
  });

  it("should handle errors during job processing", async () => {
    // Start worker
    await worker.startWorker();

    // Simulate processing error
    const error = new Error("Processing failed");
    (mockQueue.processJobs as any).mockRejectedValueOnce(error);

    // Wait for error to be handled
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Stop worker
    await worker.stopWorker();

    // Verify cleanup
    expect(mockQueue.stopProcessing).toHaveBeenCalled();
    expect(redisClient.disconnect).toHaveBeenCalled();
  });
});
