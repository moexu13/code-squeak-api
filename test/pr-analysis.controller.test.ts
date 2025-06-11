import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import authMiddleware from "../src/middleware/auth";
import prAnalysisRouter from "../src/api/pr-analysis/pr-analysis.routes";
import { StatusError } from "../src/errors/status";
import errorHandler from "../src/errors/errorHandler";

// Mock the auth middleware
vi.mock("../src/middleware/auth", () => ({
  default: (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).send("Unauthorized");
    }
    const token = authHeader.split(" ")[1];
    if (token !== "valid-key") {
      return res.status(401).send("Unauthorized");
    }
    next();
  },
}));

// Mock the GitHub service
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

// Mock the analysis service
vi.mock("../src/api/analysis/analysis.service", () => ({
  analyze: vi.fn().mockImplementation(async () => ({
    completion: "Test analysis result",
    stop_reason: "stop",
    model: "test-model",
  })),
}));

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/pr-analysis", authMiddleware, prAnalysisRouter);

// Add error handling middleware
app.use(errorHandler);

describe("PR Analysis Controller", () => {
  it("should analyze a pull request and post the analysis as a comment", async () => {
    const response = await request(app)
      .post("/api/v1/pr-analysis/test-owner/test-repo/123")
      .set("Authorization", `Bearer valid-key`)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.data).toBe("Pull request analysis completed");
  });

  it("should return 401 when no API key is provided", async () => {
    await request(app)
      .post("/api/v1/pr-analysis/test-owner/test-repo/123")
      .expect(401);
  });

  it("should return 401 when invalid API key is provided", async () => {
    await request(app)
      .post("/api/v1/pr-analysis/test-owner/test-repo/123")
      .set("Authorization", `Bearer invalid-key`)
      .expect(401);
  });

  it("should return 404 for invalid PR number", async () => {
    await request(app)
      .post("/api/v1/pr-analysis/test-owner/test-repo/999999")
      .set("Authorization", `Bearer valid-key`)
      .expect(404);
  });

  it("should accept optional parameters", async () => {
    const response = await request(app)
      .post("/api/v1/pr-analysis/test-owner/test-repo/123")
      .set("Authorization", `Bearer valid-key`)
      .send({
        model: "claude-3",
        max_tokens: 2000,
        temperature: 0.5,
      })
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.data).toBe("Pull request analysis completed");
  });
});
