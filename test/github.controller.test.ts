import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import authMiddleware from "../src/middleware/auth";
import githubRouter from "../src/api/github/github.routes";
import { StatusError } from "../src/errors/status";
import { redisClient } from "../src/utils/redis";

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
  list: vi.fn().mockImplementation(async (options) => ({
    data: [
      {
        id: 1,
        name: "test-repo",
        full_name: "test-owner/test-repo",
        description: "Test repository",
        html_url: "https://github.com/test-owner/test-repo",
        updated_at: new Date().toISOString(),
        stargazers_count: 0,
        language: "TypeScript",
      },
    ],
    pagination: {
      current_page: options?.page || 1,
      per_page: options?.per_page || 10,
      total_pages: 1,
    },
  })),
  read: vi.fn().mockImplementation(async () => [
    {
      id: 1,
      number: 4,
      title: "Test PR",
      user: { login: "testuser" },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      body: "Test PR body",
      comments: 0,
      additions: 10,
      deletions: 5,
      body_preview: "Test PR body",
    },
  ]),
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
  getDiff: vi.fn().mockImplementation(async (_owner, _repo, pullNumber) => {
    if (parseInt(pullNumber) === 999999) {
      throw new StatusError("Pull request not found", 404);
    }
    if (parseInt(pullNumber) === 999998) {
      return "a".repeat(20 * 1024); // 20KB of data
    }
    if (parseInt(pullNumber) === 999997) {
      return "secret123\nother content";
    }
    return "test diff content";
  }),
}));

// Create test app
const app = express();
app.use(express.json());
app.use("/api/v1/github", authMiddleware, githubRouter);

// Test configuration
const TEST_API_KEY = "valid-key";

describe("GitHub Controller", () => {
  beforeAll(async () => {
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  describe("GET /api/v1/github/:owner", () => {
    it("should list repositories for a user", async () => {
      const response = await request(app)
        .get("/api/v1/github/moexu13")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.pagination).toBeDefined();
    });

    it("should handle pagination", async () => {
      const response = await request(app)
        .get("/api/v1/github/moexu13?page=1&per_page=5")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(10);
      expect(response.body.pagination.per_page).toBe(10);
    });
  });

  describe("GET /api/v1/github/:owner/:repo", () => {
    it("should get pull requests for a repository", async () => {
      const response = await request(app)
        .get("/api/v1/github/moexu13/code-squeak-api")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      const pr = response.body[0];
      expect(pr).toHaveProperty("id");
      expect(pr).toHaveProperty("number");
      expect(pr).toHaveProperty("title");
      expect(pr).toHaveProperty("user");
      expect(pr).toHaveProperty("comments");
      expect(pr).toHaveProperty("additions");
      expect(pr).toHaveProperty("deletions");
      expect(pr).toHaveProperty("created_at");
      expect(pr).toHaveProperty("updated_at");
      expect(pr).toHaveProperty("body_preview");
    });
  });

  describe("GET /api/v1/github/:owner/:repo/:pull_number/diff", () => {
    it("should get diff for a pull request", async () => {
      const response = await request(app)
        .get("/api/v1/github/test-owner/test-repo/123/diff")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toBe("test diff content");
    });

    it("should truncate large diffs", async () => {
      const response = await request(app)
        .get("/api/v1/github/test-owner/test-repo/999998/diff")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(10 * 1024 + 100); // 10KB + some extra for the truncation message
    });

    it("should redact sensitive data", async () => {
      const response = await request(app)
        .get("/api/v1/github/test-owner/test-repo/999997/diff")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .expect(200);

      expect(response.body.data).not.toContain("secret123");
    });

    it("should return 404 for invalid PR number", async () => {
      await request(app)
        .get("/api/v1/github/test-owner/test-repo/999999/diff")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .expect(404);
    });
  });

  describe("POST /api/v1/github/:owner/:repo/:pull_number/comments", () => {
    it("should create a comment on a pull request", async () => {
      const response = await request(app)
        .post("/api/v1/github/test-owner/test-repo/123/comments")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .send({ data: { comment: "Test comment" } })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it("should return 400 when comment is missing", async () => {
      await request(app)
        .post("/api/v1/github/test-owner/test-repo/123/comments")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .send({ data: {} })
        .expect(400);
    });

    it("should return 404 for invalid PR number", async () => {
      await request(app)
        .post("/api/v1/github/test-owner/test-repo/999999/comments")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .send({ data: { comment: "Test comment" } })
        .expect(404);
    });

    it("should reject payloads larger than 100KB", async () => {
      const response = await request(app)
        .post("/api/v1/github/test-owner/test-repo/123/comments")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .set("Content-Length", (102400 + 100).toString()) // 100KB + 100 bytes
        .send({ data: { comment: "Test comment" } });

      expect(response.status).toBe(413);
      expect(response.body.error).toBe("Payload too large");
      expect(response.body.message).toBe(
        "Comment payload too large. Maximum size is 100KB for pull request comments"
      );
    });
  });
});
