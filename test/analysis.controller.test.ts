import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import analysisRouter from "../src/api/analysis/analysis.routes";
import { ModelFactory } from "../src/api/analysis/models/factory";
import { HttpError } from "../src/errors/http";

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

describe("Analysis Controller", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/code-analysis", analysisRouter);

  // Add error handling middleware
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
      } else {
        res.status(500).json({ error: "Something went wrong" });
      }
    }
  );

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

  it("should return 400 if diff is missing", async () => {
    const response = await request(app)
      .post("/api/v1/code-analysis")
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toBe("Diff is required");
  });

  it("should analyze diff with default values", async () => {
    const response = await request(app)
      .post("/api/v1/code-analysis")
      .send({ diff: "test diff" })
      .expect(200);

    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toEqual({
      completion: "test completion",
      stop_reason: "stop",
      model: "test-model",
    });
  });

  it("should analyze diff with custom values", async () => {
    const response = await request(app)
      .post("/api/v1/code-analysis")
      .send({
        diff: "test diff",
        max_tokens: 2000,
        temperature: 0.5,
        title: "Custom PR",
        description: "Custom description",
        author: "Custom Author",
        state: "closed",
        url: "https://custom.com",
      })
      .expect(200);

    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toEqual({
      completion: "test completion",
      stop_reason: "stop",
      model: "test-model",
    });
  });
});
