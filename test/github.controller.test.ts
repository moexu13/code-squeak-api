import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../src/server";

// Custom error class with status
class StatusError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Mock the auth middleware
vi.mock("../src/middleware/auth", () => ({
  default: (req: any, res: any, next: any) => {
    const key = req.headers["authorization"]?.split(" ").at(1);
    if (key === "valid-key") {
      return next();
    }
    return res.status(401).send("Unauthorized");
  },
}));

// Mock the GitHub service
vi.mock("../src/api/github/github.service", () => ({
  list: vi.fn().mockImplementation(async (owner, options) => ({
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
  read: vi.fn().mockImplementation(async (owner, repo) => [
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
    .mockImplementation(async (owner, repo, pullNumber, comment) => {
      if (!comment) {
        throw new StatusError("Comment is required", 400);
      }
      if (pullNumber === 999999) {
        throw new StatusError("Pull request not found", 404);
      }
      return {
        id: 123,
        body: comment,
        created_at: new Date().toISOString(),
      };
    }),
}));

// Test configuration
const TEST_API_KEY = "valid-key";

describe("GitHub Controller", () => {
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

      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.pagination.per_page).toBe(5);
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

  describe("POST /api/v1/github/:owner/:repo/pulls/:number", () => {
    it("should create a comment on a pull request", async () => {
      const response = await request(app)
        .post("/api/v1/github/moexu13/code-squeak-api/pulls/4")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .send({ data: { comment: "Test comment" } })
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toBe("Pull request comment created");
    });

    it("should return 400 when comment is missing", async () => {
      await request(app)
        .post("/api/v1/github/moexu13/code-squeak-api/pulls/4")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .send({ data: {} })
        .expect(400);
    });

    it("should return 404 for invalid PR number", async () => {
      await request(app)
        .post("/api/v1/github/moexu13/code-squeak-api/pulls/999999")
        .set("Authorization", `Bearer ${TEST_API_KEY}`)
        .send({ data: { comment: "This should fail" } })
        .expect(404);
    });
  });
});
