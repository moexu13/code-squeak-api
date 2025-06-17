import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { redisClient } from "../src/utils/redis";
import { AnalysisQueue } from "../src/api/analysis/analysis.queue";
import { AnalysisWorker } from "../src/workers/analysis.worker";

// Mock the analyzePullRequest function
vi.mock("../src/api/analysis/analysis.service", () => ({
  analyzePullRequest: vi.fn().mockResolvedValue(undefined),
  PRAnalysisParams: {},
}));

describe("Analysis Worker", () => {
  let queue: AnalysisQueue;
  let worker: AnalysisWorker;

  beforeAll(async () => {
    await redisClient.connect();
    queue = AnalysisQueue.getInstance();
    await queue.initialize();
  });

  afterAll(async () => {
    if (worker) {
      await worker.stopWorker();
    }
    await redisClient.disconnect();
  });

  it("should process jobs in the queue", async () => {
    // Add a test job
    const job = await queue.addJob({
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 123,
    });

    // Start worker
    worker = new AnalysisWorker();
    await worker.startWorker();

    // Wait for job to be processed
    let currentJob = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      currentJob = await queue.getJob(job.id);
      if (currentJob?.status === "completed") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    expect(currentJob?.status).toBe("completed");
    await worker.stopWorker();
  }, 30000);

  it("should handle worker shutdown gracefully", async () => {
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    worker = new AnalysisWorker();
    await worker.startWorker();

    const sigtermHandler = process.listeners("SIGTERM").pop();
    if (sigtermHandler) {
      await sigtermHandler("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockExit).toHaveBeenCalledWith(0);
    }

    mockExit.mockRestore();
    await worker.stopWorker();
  }, 10000);

  it("should handle worker errors", async () => {
    vi.spyOn(redisClient, "connect").mockRejectedValueOnce(
      new Error("Connection failed")
    );

    worker = new AnalysisWorker();
    await expect(worker.startWorker()).rejects.toThrow("Connection failed");
  }, 10000);
});
