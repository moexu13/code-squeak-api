import { describe, it, expect, beforeEach, vi } from "vitest";
import { analyze } from "../src/api/analysis/analysis.service";
import { ClaudeModel } from "../src/api/analysis/models/claude.model";

// Mock the dependencies
vi.mock("../src/api/analysis/models/claude.model", () => ({
  ClaudeModel: vi.fn().mockImplementation(() => ({
    analyze: vi.fn(),
  })) as unknown as typeof ClaudeModel,
}));

vi.mock("../src/api/analysis/models/config", () => ({
  getModelSettings: vi.fn().mockReturnValue({
    apiKey: "test-key",
    model: "test-model",
    maxTokens: 1000,
    temperature: 0.7,
  }),
}));

vi.mock("../src/utils/cache");
vi.mock("../src/utils/logger");

describe("Analysis Service", () => {
  const mockDiff = "test diff";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use default values when not provided", async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      completion: "test completion",
      stop_reason: "stop",
      model: "test-model",
    });
    vi.mocked(ClaudeModel).mockImplementation(
      () =>
        ({
          analyze: mockAnalyze,
        } as unknown as ClaudeModel)
    );

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
    const mockAnalyze = vi.fn().mockResolvedValue({
      completion: "test completion",
      stop_reason: "stop",
      model: "test-model",
    });
    vi.mocked(ClaudeModel).mockImplementation(
      () =>
        ({
          analyze: mockAnalyze,
        } as unknown as ClaudeModel)
    );

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
    vi.mocked(ClaudeModel).mockImplementation(
      () =>
        ({
          analyze: vi.fn().mockRejectedValue(mockError),
        } as unknown as ClaudeModel)
    );

    await expect(analyze({ diff: mockDiff })).rejects.toThrow("Test error");
  });
});
