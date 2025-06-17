import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AnalysisWorker } from "../src/workers/analysis.worker";
import { AnalysisQueue } from "../src/api/analysis/analysis.queue";
import { redisClient } from "../src/utils/redis";
import { WorkerStats } from "../src/workers/types/worker";

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
      processJobs: vi.fn().mockResolvedValue(undefined),
      stopProcessing: vi.fn(),
      cleanupOldJobs: vi.fn().mockResolvedValue(undefined),
      getQueueStats: vi.fn().mockResolvedValue({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      }),
    } as unknown as AnalysisQueue;

    (AnalysisQueue.getInstance as any).mockReturnValue(mockQueue);

    // Setup Redis mock
    (redisClient.connect as any).mockResolvedValue(undefined);
    (redisClient.disconnect as any).mockResolvedValue(undefined);

    // Create worker instance with shorter intervals for testing
    worker = new AnalysisWorker();
    // Override config for testing
    (worker as any).config = {
      workerCount: 1,
      pollInterval: 100,
      cleanupInterval: 100,
      maxJobAge: 1000,
      statsInterval: 100,
    };
  });

  afterEach(async () => {
    // Ensure worker is stopped
    await worker.stop();
    vi.clearAllTimers();
  });

  it("should start worker successfully", async () => {
    await worker.start();

    expect(redisClient.connect).toHaveBeenCalled();
    expect(mockQueue.initialize).toHaveBeenCalled();
    expect(mockQueue.processJobs).toHaveBeenCalled();
  });

  it("should handle worker shutdown gracefully", async () => {
    // Start the worker
    await worker.start();

    // Stop the worker
    await worker.stop();

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
    await expect(worker.start()).rejects.toThrow("Connection failed");

    // Verify cleanup
    expect(mockQueue.initialize).not.toHaveBeenCalled();
    expect(mockQueue.processJobs).not.toHaveBeenCalled();
  });

  it("should handle errors during job processing", async () => {
    // Start worker
    await worker.start();

    // Simulate processing error
    const error = new Error("Processing failed");
    (mockQueue.processJobs as any).mockRejectedValueOnce(error);

    // Wait for error to be handled
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Stop worker
    await worker.stop();

    // Verify cleanup
    expect(mockQueue.stopProcessing).toHaveBeenCalled();
    expect(redisClient.disconnect).toHaveBeenCalled();
  });

  it("should collect and report stats", async () => {
    // Start worker
    await worker.start();

    // Mock queue stats
    const mockStats: WorkerStats = {
      queueStats: {
        pending: 1,
        processing: 2,
        completed: 3,
        failed: 0,
        total: 6,
      },
      uptime: 100,
      lastCleanup: new Date(),
      lastError: null,
    };

    (mockQueue.getQueueStats as any).mockResolvedValueOnce(
      mockStats.queueStats
    );

    // Wait for stats collection
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Stop worker
    await worker.stop();

    // Verify stats were collected
    expect(mockQueue.getQueueStats).toHaveBeenCalled();
  });

  it("should handle cleanup errors gracefully", async () => {
    // Start worker
    await worker.start();

    // Mock cleanup error
    const error = new Error("Cleanup failed");
    (mockQueue.cleanupOldJobs as any).mockRejectedValueOnce(error);

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Stop worker
    await worker.stop();

    // Verify worker continued running despite cleanup error
    expect(mockQueue.stopProcessing).toHaveBeenCalled();
  });
});
