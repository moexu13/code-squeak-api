import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import analysisRouter from "../src/api/analysis/analysis.routes";
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

// Mock cache functions
vi.mock("../src/utils/cache", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  generateCacheKey: vi.fn().mockReturnValue("test-cache-key"),
}));

vi.mock("../src/utils/logger");

describe("Analysis Endpoint", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/code-analysis", analysisRouter);

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

  it("should return 200 for POST request", async () => {
    const response = await request(app)
      .post("/api/v1/code-analysis")
      .send({ diff: "test diff" })
      .expect("Content-Type", /json/)
      .expect(200);

    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toEqual({
      completion: "test completion",
      stop_reason: "stop",
      model: "test-model",
    });
  });
});
