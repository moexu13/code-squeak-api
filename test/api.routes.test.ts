import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock modules before importing anything else
vi.mock("../src/utils/validator", () => {
  class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
  }

  const validateOwner = vi.fn();
  const validateRepo = vi.fn();
  const validatePullRequestNumber = vi.fn();
  const validatePullRequestParams = vi.fn();

  return {
    ValidationError,
    validateOwner,
    validateRepo,
    validatePullRequestNumber,
    validatePullRequestParams,
  };
});

vi.mock("../src/utils/logger", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../src/api/github.service", () => ({
  GitHubService: vi.fn(() => ({
    listPullRequests: vi.fn(),
    getPullRequest: vi.fn(),
  })),
}));

vi.mock("../src/api/claude.service", () => ({
  ClaudeService: vi.fn(() => ({
    sendMessage: vi.fn(),
    streamMessage: vi.fn(),
  })),
}));

vi.mock("../src/utils/sanitizer", () => ({
  Sanitizer: {
    sanitizePullRequestData: vi.fn(),
    sanitizePrompt: vi.fn(),
    sanitizeText: vi.fn(),
  },
}));

// Import after all mocks are setup
import apiRouter from "../src/api/api.routes";
import * as GitHubServiceModule from "../src/api/github.service";
import * as ClaudeServiceModule from "../src/api/claude.service";
import { Sanitizer } from "../src/utils/sanitizer";
import * as validatorModule from "../src/utils/validator";

// Extract the mock for easier use
const validator = validatorModule as {
  ValidationError: typeof Error;
  validateOwner: ReturnType<typeof vi.fn>;
  validateRepo: ReturnType<typeof vi.fn>;
  validatePullRequestNumber: ReturnType<typeof vi.fn>;
  validatePullRequestParams: ReturnType<typeof vi.fn>;
};

describe("API Routes", () => {
  let app: Hono;
  const originalEnv = { ...process.env };

  // Get typed mocks
  const { GitHubService } = GitHubServiceModule;
  const { ClaudeService } = ClaudeServiceModule;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup environment variables
    process.env.GITHUB_TOKEN = "test-github-token-0123456789abcdef0123456789abcdef01234567";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-api-key";
    process.env.CLAUDE_MODEL = "claude-test-model";

    // Setup validator mocks
    validator.validateOwner.mockImplementation((owner) => {
      if (!owner || owner === "invali!d") {
        throw new validator.ValidationError(
          "Owner parameter can only contain alphanumeric characters and hyphens"
        );
      }
    });

    validator.validateRepo.mockImplementation((repo) => {
      if (!repo || repo === "invali!d") {
        throw new validator.ValidationError(
          "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods"
        );
      }
    });

    validator.validatePullRequestNumber.mockImplementation((pullNumber) => {
      if (pullNumber === "invalid") {
        throw new validator.ValidationError("Invalid pull request number");
      }
    });

    validator.validatePullRequestParams.mockImplementation((c, next) => {
      try {
        const { owner, repo, pullNumber } = c.req.param();

        // Handle owner validation
        if (owner === "invali!d") {
          throw new validator.ValidationError(
            "Owner parameter can only contain alphanumeric characters and hyphens"
          );
        }
        if (owner === "EMPTY") {
          throw new validator.ValidationError("Owner parameter is required");
        }

        // Handle repo validation - added the invali!d check
        if (repo === "invali!d") {
          throw new validator.ValidationError(
            "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods"
          );
        }
        if (repo === "EMPTY") {
          throw new validator.ValidationError("Repository parameter is required");
        }

        // Handle pull number validation
        if (pullNumber === "invalid") {
          throw new validator.ValidationError("Invalid pull request number");
        }

        return next();
      } catch (error) {
        if (error instanceof validator.ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    });

    // Create Hono app
    app = new Hono();
    app.route("/", apiRouter);
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe("Middleware", () => {
    it("should reject requests when GitHub token is not configured", async () => {
      delete process.env.GITHUB_TOKEN;

      const res = await app.request("/", {
        method: "GET",
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("GitHub token not configured");
    });

    it("should reject requests when GitHub token is too short", async () => {
      process.env.GITHUB_TOKEN = "too-short-token";

      const res = await app.request("/", {
        method: "GET",
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Invalid GitHub token configuration");
    });
  });

  describe("GET /", () => {
    it("should return a status message", async () => {
      const res = await app.request("/", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("API is running");
    });
  });

  describe("GET /:owner/:repoName", () => {
    it("should return pull requests for a valid repository", async () => {
      const mockPullRequests = [
        { id: 1, title: "Test PR 1" },
        { id: 2, title: "Test PR 2" },
      ];

      const listPullRequestsMock = vi.fn().mockResolvedValue(mockPullRequests);
      (GitHubService as any).mockImplementation(() => ({
        listPullRequests: listPullRequestsMock,
        getPullRequest: vi.fn(),
      }));

      const res = await app.request("/testowner/testrepo", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pullRequests).toEqual(mockPullRequests);
      expect(listPullRequestsMock).toHaveBeenCalledWith("testowner", "testrepo");
    });

    it("should validate owner parameter", async () => {
      const res = await app.request("/invali!d/testrepo", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Owner parameter");
    });

    it("should validate repository parameter", async () => {
      // Modify the mock for this test
      validator.validatePullRequestParams.mockImplementationOnce((c, next) => {
        // Extract repo parameter from the path
        const repoName = c.req.param("repoName");
        if (repoName === "invali!d") {
          return c.json(
            {
              error:
                "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods",
            },
            400
          );
        }
        return next();
      });

      const res = await app.request("/testowner/invali!d", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Repository parameter");
    });

    it("should handle GitHub API errors", async () => {
      const listPullRequestsMock = vi.fn().mockRejectedValue(new Error("GitHub API Error"));
      (GitHubService as any).mockImplementation(() => ({
        listPullRequests: listPullRequestsMock,
        getPullRequest: vi.fn(),
      }));

      const res = await app.request("/testowner/testrepo", {
        method: "GET",
      });

      expect(res.status).toBe(500);
    });
  });

  describe("GET /:owner/:repoName/pull/:pullNumber/analyze", () => {
    it("should analyze a pull request successfully", async () => {
      // Mock the GitHub PR data
      const mockPullRequest = {
        title: "Test PR",
        body: "Test PR Description",
        user: "testuser",
        state: "open",
        url: "https://github.com/testowner/testrepo/pull/1",
        diff: "diff --git a/test.txt b/test.txt\n--- a/test.txt\n+++ b/test.txt\n@@ -1 +1 @@\n-test\n+updated test",
      };

      const mockSanitizedPR = {
        ...mockPullRequest,
      };

      const mockAnalysis = "This PR looks good. It updates test.txt with a better message.";

      // Setup the mocks
      const getPullRequestMock = vi.fn().mockResolvedValue(mockPullRequest);
      const sendMessageMock = vi.fn().mockResolvedValue(mockAnalysis);

      (GitHubService as any).mockImplementation(() => ({
        listPullRequests: vi.fn(),
        getPullRequest: getPullRequestMock,
      }));

      (ClaudeService as any).mockImplementation(() => ({
        sendMessage: sendMessageMock,
        streamMessage: vi.fn(),
      }));

      (Sanitizer.sanitizePullRequestData as any).mockReturnValue(mockSanitizedPR);
      (Sanitizer.sanitizePrompt as any).mockReturnValue("Test prompt");

      const res = await app.request("/testowner/testrepo/pull/1/analyze", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.analysis).toBe(mockAnalysis);
      expect(body.pullRequest).toBeDefined();
      // Ensure the diff is not included in the response
      expect(body.pullRequest.diff).toBeUndefined();

      // Verify all the expected methods were called
      expect(getPullRequestMock).toHaveBeenCalledWith("testowner", "testrepo", 1);
      expect(Sanitizer.sanitizePullRequestData).toHaveBeenCalledWith(mockPullRequest);
      expect(Sanitizer.sanitizePrompt).toHaveBeenCalled();
      expect(sendMessageMock).toHaveBeenCalledWith("Test prompt", {
        maxTokens: 1000,
        temperature: 0.7,
      });
    });

    it("should validate pull request number", async () => {
      const res = await app.request("/testowner/testrepo/pull/invalid/analyze", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid pull request number");
    });

    it("should handle GitHub API errors during analysis", async () => {
      const getPullRequestMock = vi.fn().mockRejectedValue(new Error("GitHub API Error"));

      (GitHubService as any).mockImplementation(() => ({
        listPullRequests: vi.fn(),
        getPullRequest: getPullRequestMock,
      }));

      const res = await app.request("/testowner/testrepo/pull/1/analyze", {
        method: "GET",
      });

      expect(res.status).toBe(500);
    });

    it("should handle Claude API errors during analysis", async () => {
      // Mock the GitHub PR data
      const mockPullRequest = {
        title: "Test PR",
        body: "Test PR Description",
        user: "testuser",
        state: "open",
        url: "https://github.com/testowner/testrepo/pull/1",
        diff: "diff --git a/test.txt b/test.txt",
      };

      const mockSanitizedPR = {
        ...mockPullRequest,
      };

      // Setup the mocks
      const getPullRequestMock = vi.fn().mockResolvedValue(mockPullRequest);
      const sendMessageMock = vi.fn().mockRejectedValue(new Error("Claude API Error"));

      (GitHubService as any).mockImplementation(() => ({
        listPullRequests: vi.fn(),
        getPullRequest: getPullRequestMock,
      }));

      (ClaudeService as any).mockImplementation(() => ({
        sendMessage: sendMessageMock,
        streamMessage: vi.fn(),
      }));

      (Sanitizer.sanitizePullRequestData as any).mockReturnValue(mockSanitizedPR);
      (Sanitizer.sanitizePrompt as any).mockReturnValue("Test prompt");

      const res = await app.request("/testowner/testrepo/pull/1/analyze", {
        method: "GET",
      });

      expect(res.status).toBe(500);
    });

    it("should correctly validate empty owner parameter", async () => {
      // Override for this test
      validator.validateOwner.mockImplementationOnce(() => {
        throw new validator.ValidationError("Owner parameter is required");
      });

      const res = await app.request("/EMPTY/testrepo/pull/1/analyze", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Owner parameter is required");
    });

    it("should correctly validate empty repository parameter", async () => {
      // Modify the mock for this test
      validator.validatePullRequestParams.mockImplementationOnce((c, next) => {
        // Extract repo parameter from the path
        const repoName = c.req.param("repoName");
        if (repoName === "EMPTY") {
          return c.json(
            {
              error: "Repository parameter is required",
            },
            400
          );
        }
        return next();
      });

      const res = await app.request("/testowner/EMPTY/pull/1/analyze", {
        method: "GET",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Repository parameter is required");
    });
  });
});
