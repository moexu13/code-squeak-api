import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  analyze,
  analyzePullRequest,
} from "../src/api/analysis/analysis.service";
import { ModelFactory } from "../src/api/analysis/models/factory";
import { getCached, setCached, generateCacheKey } from "../src/utils/cache";
import {
  getDiff,
  create as createComment,
} from "../src/api/github/github.service";

// Mock the dependencies
vi.mock("../src/api/analysis/models/factory", () => ({
  ModelFactory: {
    getInstance: vi.fn().mockReturnValue({
      createModel: vi.fn(),
    }),
  },
}));

vi.mock("../src/api/analysis/models/config", () => ({
  getModelSettings: vi.fn().mockReturnValue({
    apiKey: "test-key",
    model: "test-model",
    maxTokens: 1000,
    temperature: 0.7,
  }),
}));

vi.mock("../src/utils/cache", () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  generateCacheKey: vi.fn().mockImplementation((prefix, params) => {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join(":");
    return `${prefix}:${sortedParams}`;
  }),
}));

vi.mock("../src/utils/logger");
vi.mock("../src/api/github/github.service");

describe("Analysis Service", () => {
  const mockDiff = "test diff";
  const mockAnalyze = vi.fn().mockResolvedValue({
    completion: "test completion",
    stop_reason: "stop",
    model: "test-model",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ModelFactory.getInstance().createModel).mockReturnValue({
      analyze: mockAnalyze,
    });
    vi.mocked(getDiff).mockResolvedValue(mockDiff);
    vi.mocked(createComment).mockResolvedValue({
      id: 123,
      body: "test comment",
    });
  });

  it("should use default values when not provided", async () => {
    await analyze({ diff: mockDiff });

    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.stringContaining(mockDiff),
      expect.objectContaining({
        max_tokens: undefined,
        temperature: undefined,
      })
    );
  });

  it("should use provided values when available", async () => {
    const customParams = {
      diff: mockDiff,
      max_tokens: 2000,
      temperature: 0.5,
      title: "Custom PR",
      description: "Custom description",
      author: "Custom Author",
      state: "closed",
      url: "https://custom.com",
    };

    await analyze(customParams);

    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.stringContaining("Custom PR"),
      expect.objectContaining({
        max_tokens: 2000,
        temperature: 0.5,
      })
    );
  });

  it("should handle errors gracefully", async () => {
    const mockError = new Error("Test error");
    vi.mocked(ModelFactory.getInstance().createModel).mockReturnValue({
      analyze: vi.fn().mockRejectedValue(mockError),
    });

    await expect(analyze({ diff: mockDiff })).rejects.toThrow("Test error");
  });

  describe("PR Analysis Caching", () => {
    const prParams = {
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 123,
      model: "test-model",
      max_tokens: 1000,
      temperature: 0.7,
    };

    it("should use cached analysis when available", async () => {
      const cachedAnalysis = {
        completion: "cached analysis result",
      };
      vi.mocked(getCached).mockResolvedValueOnce(cachedAnalysis);

      await analyzePullRequest(prParams);

      // Verify cache was checked
      expect(getCached).toHaveBeenCalledWith(
        expect.stringContaining("analysis:pr")
      );

      // Verify cached result was used
      expect(createComment).toHaveBeenCalledWith(
        prParams.owner,
        prParams.repo,
        prParams.pull_number,
        cachedAnalysis.completion
      );

      // Verify no new analysis was performed
      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it("should perform new analysis and cache result when no cache exists", async () => {
      vi.mocked(getCached).mockResolvedValueOnce(null);

      await analyzePullRequest(prParams);

      // Verify cache was checked
      expect(getCached).toHaveBeenCalledWith(
        expect.stringContaining("analysis:pr")
      );

      // Verify new analysis was performed
      expect(mockAnalyze).toHaveBeenCalled();

      // Verify result was cached
      expect(setCached).toHaveBeenCalledWith(
        expect.stringContaining("analysis:pr"),
        expect.objectContaining({
          completion: "test completion",
        })
      );

      // Verify comment was created with new analysis
      expect(createComment).toHaveBeenCalledWith(
        prParams.owner,
        prParams.repo,
        prParams.pull_number,
        "test completion"
      );
    });

    it("should generate unique cache keys for different PRs", async () => {
      const pr1 = { ...prParams, pull_number: 1 };
      const pr2 = { ...prParams, pull_number: 2 };

      await analyzePullRequest(pr1);
      await analyzePullRequest(pr2);

      // Verify different cache keys were generated
      const calls = vi.mocked(generateCacheKey).mock.calls;

      // Filter for PR analysis cache keys
      const prCacheCalls = calls.filter((call) => call[0] === "analysis:pr");
      expect(prCacheCalls).toHaveLength(2);

      const key1 =
        prCacheCalls[0][0] +
        ":" +
        Object.entries(prCacheCalls[0][1])
          .sort()
          .map(([k, v]) => `${k}:${v}`)
          .join(":");
      const key2 =
        prCacheCalls[1][0] +
        ":" +
        Object.entries(prCacheCalls[1][1])
          .sort()
          .map(([k, v]) => `${k}:${v}`)
          .join(":");

      // Verify the keys are different
      expect(key1).not.toBe(key2);

      // Verify the keys contain the correct pull numbers
      expect(key1).toContain("pull_number:1");
      expect(key2).toContain("pull_number:2");
    });

    it("should include all parameters in cache key", async () => {
      await analyzePullRequest(prParams);

      expect(generateCacheKey).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          owner: prParams.owner,
          repo: prParams.repo,
          pull_number: prParams.pull_number,
          model: prParams.model,
          max_tokens: prParams.max_tokens,
          temperature: prParams.temperature,
        })
      );
    });
  });
});
