import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
  afterEach,
} from "vitest";
import { redisClient } from "../src/utils/redis";
import { AnalysisQueue } from "../src/api/analysis/analysis.queue";
import { AnalysisWorker } from "../src/workers/analysis.worker";
import { PRAnalysisParams } from "../src/api/analysis/types/queue";

// Mock the module before any imports that use it
vi.mock("../src/api/analysis/analysis.service", () => ({
  analyzePullRequest: vi.fn(),
  PRAnalysisParams: {
    owner: "",
    repo: "",
    pull_number: 0,
    model: "",
    max_tokens: 0,
    temperature: 0,
  },
}));

// Import the mocked function after the mock is set up
import { analyzePullRequest } from "../src/api/analysis/analysis.service";

describe("AnalysisQueue", () => {
  let queue: AnalysisQueue;
  let worker: AnalysisWorker | undefined;

  beforeAll(async () => {
    await redisClient.connect();
    queue = AnalysisQueue.getInstance();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  beforeEach(async () => {
    // Reset mock
    vi.mocked(analyzePullRequest).mockReset();
  });

  afterEach(async () => {
    // Clean up Redis keys after each test
    const client = redisClient.getClient();
    const keys = await client.keys("pr-analysis:*");
    if (keys.length > 0) {
      await client.del(keys);
    }
  });

  it("should add a job to the queue", async () => {
    const params: PRAnalysisParams = {
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 123,
    };

    const job = await queue.addJob(params);
    expect(job).toBeDefined();

    const retrievedJob = await queue.getJob(job.id);
    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.params).toEqual(params);
    expect(retrievedJob?.status).toBe("pending");
    expect(retrievedJob?.created_at).toBeDefined();
    expect(retrievedJob?.updated_at).toBeDefined();
  });

  it("should update job status", async () => {
    const params: PRAnalysisParams = {
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 123,
    };

    const job = await queue.addJob(params);
    await queue.updateJobStatus(job.id, "processing");

    const retrievedJob = await queue.getJob(job.id);
    expect(retrievedJob?.status).toBe("processing");
  });

  it("should handle job processing", async () => {
    // Mock analyzePullRequest to succeed
    vi.mocked(analyzePullRequest).mockResolvedValueOnce(undefined);

    const params: PRAnalysisParams = {
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 123,
    };

    const job = await queue.addJob(params);

    // Start a worker to process the job
    worker = new AnalysisWorker();
    await worker.start();

    // Wait for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check job status
    const retrievedJob = await queue.getJob(job.id);
    expect(retrievedJob?.status).toBe("completed");
    // Clean up
    await worker.stop();
    worker = undefined;
    // Reset queue singleton
    (AnalysisQueue as any).instance = null;
    await redisClient.connect();
    queue = await AnalysisQueue.getInstanceAsync();
  });

  it("should handle job failures and retries", async () => {
    // Mock analyzePullRequest to fail
    vi.mocked(analyzePullRequest).mockRejectedValueOnce(
      new Error("Test error")
    );

    const params: PRAnalysisParams = {
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 123,
    };

    const job = await queue.addJob(params);

    // Start a worker to process the job
    worker = new AnalysisWorker();
    await worker.start();

    // Wait for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check job status
    const retrievedJob = await queue.getJob(job.id);
    expect(retrievedJob?.status).toBe("failed");
    expect(retrievedJob?.error).toBeDefined();

    // Clean up (after all assertions)
    await worker.stop();
    worker = undefined;
    (AnalysisQueue as any).instance = null;
    await redisClient.connect();
    queue = await AnalysisQueue.getInstanceAsync();
  });

  it("should mark job as failed after max retries", async () => {
    // Mock analyzePullRequest to always fail
    vi.mocked(analyzePullRequest).mockRejectedValue(new Error("Test error"));

    const params: PRAnalysisParams = {
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 123,
    };

    const job = await queue.addJob(params);

    // Start a worker to process the job
    worker = new AnalysisWorker();
    await worker.start();

    // Wait for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check final job status
    const retrievedJob = await queue.getJob(job.id);
    expect(retrievedJob?.status).toBe("failed");
    expect(retrievedJob?.error).toBeDefined();

    // Clean up (after all assertions)
    await worker.stop();
    worker = undefined;
    (AnalysisQueue as any).instance = null;
    await redisClient.connect();
    queue = await AnalysisQueue.getInstanceAsync();
  }, 10000); // Increase timeout for this test
});
