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

  it("should send diff to Claude with default prompt", async () => {
    const testDiff = `
diff --git a/src/file1.ts b/src/file1.ts
index abc123..def456 789
--- a/src/file1.ts
+++ b/src/file1.ts
@@ -1,5 +1,5 @@
-const oldCode = "test";
+const newCode = "test";
`;

    const response = await request(app)
      .post("/api/v1/code-analysis")
      .send({ diff: testDiff })
      .expect(200);

    // Verify the response
    expect(response.body).toHaveProperty("data");
    expect(response.body.data).toEqual({
      completion: "test completion",
      stop_reason: "stop",
      model: "test-model",
    });

    // Verify the model was called with correct parameters
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    const [prompt, config] = mockAnalyze.mock.calls[0];

    // Verify the prompt contains the diff
    expect(prompt).toContain(testDiff);

    // Verify the prompt contains the expected structure with default values
    expect(prompt).toContain("Title: Pull Request");
    expect(prompt).toContain("Description: ");
    expect(prompt).toContain("Author: Unknown");
    expect(prompt).toContain("State: open");
    expect(prompt).toContain("URL: ");
    expect(prompt).toContain("Please provide a concise analysis focusing on:");
    expect(prompt).toContain("1. Code quality and maintainability");
    expect(prompt).toContain(
      "2. Idiomatic code and adherence to best practices"
    );
    expect(prompt).toContain("3. Potential bugs or edge cases");

    // Verify default config values
    expect(config).toEqual({
      max_tokens: undefined,
      temperature: undefined,
    });
  });
});
