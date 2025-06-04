import { describe, it, expect, beforeEach, vi } from "vitest";
import { analyze } from "../src/api/analysis/analysis.service";
import { ModelFactory } from "../src/api/analysis/models/factory";

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

vi.mock("../src/utils/cache");
vi.mock("../src/utils/logger");

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
});
