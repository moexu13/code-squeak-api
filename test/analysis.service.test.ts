import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  analyze,
  analyzePullRequest,
} from "../src/api/analysis/analysis.service";
import { getCached, setCached } from "../src/utils/cache";
import {
  getDiff,
  create as createComment,
} from "../src/api/github/github.service";
import { StatusError } from "../src/errors/status";

// Mock the dependencies
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

vi.mock("../src/api/github/github.service", () => ({
  getDiff: vi.fn(),
  create: vi.fn(),
}));

// Mock the model settings
vi.mock("../src/api/analysis/models/config", () => ({
  getModelSettings: vi.fn().mockImplementation((model) => ({
    model,
    max_tokens: 1000,
    temperature: 0.7,
  })),
  supportedModels: [
    "claude-3-sonnet-20240229",
    "claude-3-opus-20240229",
    "claude-3-5-haiku-latest",
  ],
}));

// Mock the model factory
vi.mock("../src/api/analysis/models/factory", () => ({
  ModelFactory: {
    getInstance: vi.fn().mockReturnValue({
      createModel: vi.fn().mockReturnValue({
        analyze: vi.fn().mockImplementation(async (config) => ({
          completion: "Test analysis result",
          stop_reason: "end_turn",
          model: config.model || "default-model",
        })),
      }),
    }),
  },
}));

describe("Analysis Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyze", () => {
    it("should return analysis result", async () => {
      const result = await analyze({ diff: "test diff" });

      expect(result).toEqual({
        completion: "Test analysis result",
        stop_reason: "end_turn",
        model: "default-model",
      });
    });

    it("should use cached result if available", async () => {
      const cachedResult = {
        completion: "Cached analysis",
        stop_reason: "end_turn",
        model: "test-model",
      };
      vi.mocked(getCached).mockResolvedValueOnce(cachedResult);

      const result = await analyze({ diff: "test diff" });

      expect(result).toEqual(cachedResult);
      expect(getCached).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Test error");
      vi.mocked(getCached).mockRejectedValueOnce(error);

      await expect(analyze({ diff: "test diff" })).rejects.toThrow(
        "Test error"
      );
    });
  });

  describe("analyzePullRequest", () => {
    const mockParams = {
      owner: "test-owner",
      repo: "test-repo",
      pull_number: 1,
    };

    it("should use cached analysis if available", async () => {
      const cachedAnalysis = { completion: "Cached analysis" };
      vi.mocked(getCached).mockResolvedValueOnce(cachedAnalysis);

      await analyzePullRequest(mockParams);

      expect(getCached).toHaveBeenCalledTimes(1);
      expect(getDiff).not.toHaveBeenCalled();
      expect(createComment).toHaveBeenCalledWith(
        mockParams.owner,
        mockParams.repo,
        mockParams.pull_number,
        cachedAnalysis.completion
      );
    });

    it("should use cached diff if available", async () => {
      const mockDiff = "cached diff content";
      vi.mocked(getCached)
        .mockResolvedValueOnce(null) // No cached analysis
        .mockResolvedValueOnce(mockDiff); // Cached diff

      await analyzePullRequest(mockParams);

      expect(getCached).toHaveBeenCalledTimes(3); // 1 for analysis, 1 for diff, 1 for diff analysis
      expect(getDiff).not.toHaveBeenCalled();
      expect(createComment).toHaveBeenCalledWith(
        mockParams.owner,
        mockParams.repo,
        mockParams.pull_number,
        "Test analysis result"
      );
    });

    it("should fetch and cache diff if not in cache", async () => {
      const mockDiff = "new diff content";
      vi.mocked(getCached)
        .mockResolvedValueOnce(null) // No cached analysis
        .mockResolvedValueOnce(null); // No cached diff
      vi.mocked(getDiff).mockResolvedValueOnce(mockDiff);

      await analyzePullRequest(mockParams);

      expect(getCached).toHaveBeenCalledTimes(3); // 1 for analysis, 1 for diff, 1 for diff analysis
      expect(getDiff).toHaveBeenCalledWith(
        mockParams.owner,
        mockParams.repo,
        mockParams.pull_number
      );
      expect(setCached).toHaveBeenCalledTimes(3); // Once for diff, once for diff analysis, once for PR analysis
      expect(createComment).toHaveBeenCalledWith(
        mockParams.owner,
        mockParams.repo,
        mockParams.pull_number,
        "Test analysis result"
      );
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Test error");
      vi.mocked(getCached).mockRejectedValueOnce(error);

      await expect(analyzePullRequest(mockParams)).rejects.toThrow(
        new StatusError("Failed to analyze pull request", 500, {
          owner: mockParams.owner,
          repo: mockParams.repo,
          pull_number: mockParams.pull_number,
          originalError: "Test error",
        })
      );
    });
  });
});
