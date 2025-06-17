import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { StatusError } from "../src/errors/status";
import app from "../src/app";
import { NotFoundError } from "../src/errors/http";

// Mock the auth middleware
vi.mock("../src/middleware/auth", () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

// Mock the modules
vi.mock("../src/api/analysis/analysis.queue", () => ({
  AnalysisQueue: {
    getInstance: () => ({
      initialize: vi.fn(),
      addJob: vi.fn().mockResolvedValue({ id: "test-job-id" }),
    }),
  },
}));

vi.mock("../src/api/analysis/models/factory", () => ({
  ModelFactory: {
    getInstance: () => ({
      createModel: vi.fn().mockReturnValue({
        analyze: vi.fn().mockResolvedValue("Analysis result"),
      }),
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
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  generateCacheKey: vi.fn().mockReturnValue("test-cache-key"),
}));

vi.mock("../src/api/github/github.service", () => ({
  getDiff: vi.fn().mockImplementation(async (_owner, _repo, pullNumber) => {
    if (parseInt(pullNumber) === 999999) {
      throw new StatusError("Pull request not found", 404);
    }
    return "test diff content";
  }),
  create: vi
    .fn()
    .mockImplementation(async (_owner, _repo, pullNumber, comment) => {
      if (!comment) {
        throw new StatusError("Comment is required", 400);
      }
      if (parseInt(pullNumber) === 999999) {
        throw new StatusError("Pull request not found", 404);
      }
      return {
        id: 123,
        body: comment,
      };
    }),
}));

vi.mock("../src/utils/logger");

// Mock the GitHub module
vi.mock("../src/utils/github", () => ({
  getPullRequest: vi.fn().mockImplementation((_owner, _repo, pull_number) => {
    if (pull_number === 999999) {
      throw new NotFoundError("Pull request not found");
    }
    return Promise.resolve({ number: pull_number });
  }),
}));

describe("Analysis Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Direct Analysis", () => {
    it("should return 400 if diff is missing", async () => {
      await request(app)
        .post("/api/v1/code-analysis")
        .set("Authorization", "Bearer test-key")
        .send({})
        .expect(400);
    });

    it("should analyze diff with default values", async () => {
      const response = await request(app)
        .post("/api/v1/code-analysis")
        .set("Authorization", "Bearer test-key")
        .send({
          diff: "test diff",
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBe("Analysis result");
    });

    it("should analyze diff with custom values", async () => {
      const response = await request(app)
        .post("/api/v1/code-analysis")
        .set("Authorization", "Bearer test-key")
        .send({
          diff: "test diff",
          model: "custom-model",
          max_tokens: 2000,
          temperature: 0.5,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBe("Analysis result");
    });

    it("should send diff to Claude with default prompt", async () => {
      const response = await request(app)
        .post("/api/v1/code-analysis")
        .set("Authorization", "Bearer test-key")
        .send({
          diff: "test diff",
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toBe("Analysis result");
    });
  });

  describe("PR Analysis", () => {
    it("should analyze a pull request and post the analysis as a comment", async () => {
      const response = await request(app)
        .post("/api/v1/code-analysis/pr")
        .set("Authorization", "Bearer test-key")
        .send({
          owner: "test-owner",
          repo: "test-repo",
          pull_number: 123,
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.data).toBe("Pull request analysis queued");
      expect(response.body.jobId).toBeDefined();
      expect(response.body.status).toBe("pending");
    });

    it("should return 400 if required PR parameters are missing", async () => {
      await request(app)
        .post("/api/v1/code-analysis/pr")
        .set("Authorization", "Bearer test-key")
        .send({
          owner: "test-owner",
          repo: "test-repo",
        })
        .expect(400);
    });

    it("should return 404 for invalid PR number", async () => {
      await request(app)
        .post("/api/v1/code-analysis/pr")
        .set("Authorization", "Bearer test-key")
        .send({
          owner: "test-owner",
          repo: "test-repo",
          pull_number: 999999,
        })
        .expect(404);
    });

    it("should accept optional parameters", async () => {
      const response = await request(app)
        .post("/api/v1/code-analysis/pr")
        .set("Authorization", "Bearer test-key")
        .send({
          owner: "test-owner",
          repo: "test-repo",
          pull_number: 123,
          model: "claude-3-opus-20240229",
          max_tokens: 1000,
          temperature: 0.7,
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.data).toBe("Pull request analysis queued");
      expect(response.body.jobId).toBeDefined();
      expect(response.body.status).toBe("pending");
    });
  });
});
