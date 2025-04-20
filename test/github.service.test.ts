import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GitHubService } from "../src/api/github.service";
import { Octokit } from "@octokit/rest";
import {
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubValidationError,
} from "../src/utils/githubErrors";

// Mock the Octokit client
vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    pulls: {
      list: vi.fn(),
      get: vi.fn(),
    },
  })),
}));

describe("GitHubService", () => {
  let githubService: GitHubService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_TOKEN: "test-token",
    };
    githubService = new GitHubService();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw error if GITHUB_TOKEN is not set", () => {
      delete process.env.GITHUB_TOKEN;
      expect(() => new GitHubService()).toThrow(GitHubAuthenticationError);
    });
  });

  describe("listPullRequests", () => {
    it("should handle authentication errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.list.mockRejectedValueOnce({ status: 401 });

      await expect(githubService.listPullRequests("owner", "repo")).rejects.toThrow(
        GitHubAuthenticationError
      );
    });

    it("should handle rate limit errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.list.mockRejectedValueOnce({
        status: 403,
        message: "rate limit exceeded",
        response: { headers: { "retry-after": "60" } },
      });

      await expect(githubService.listPullRequests("owner", "repo")).rejects.toThrow(
        GitHubRateLimitError
      );
    });

    it("should handle not found errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.list.mockRejectedValueOnce({ status: 404 });

      await expect(githubService.listPullRequests("owner", "repo")).rejects.toThrow(
        GitHubNotFoundError
      );
    });

    it("should handle validation errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.list.mockRejectedValueOnce({
        status: 422,
        message: "Invalid request",
      });

      await expect(githubService.listPullRequests("owner", "repo")).rejects.toThrow(
        GitHubValidationError
      );
    });
  });

  describe("getPullRequest", () => {
    it("should handle authentication errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.get.mockRejectedValueOnce({ status: 401 });

      await expect(githubService.getPullRequest("owner", "repo", 1)).rejects.toThrow(
        GitHubAuthenticationError
      );
    });

    it("should handle rate limit errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.get.mockRejectedValueOnce({
        status: 403,
        message: "rate limit exceeded",
        response: { headers: { "retry-after": "60" } },
      });

      await expect(githubService.getPullRequest("owner", "repo", 1)).rejects.toThrow(
        GitHubRateLimitError
      );
    });

    it("should handle not found errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.get.mockRejectedValueOnce({ status: 404 });

      await expect(githubService.getPullRequest("owner", "repo", 1)).rejects.toThrow(
        GitHubNotFoundError
      );
    });

    it("should handle validation errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.get.mockRejectedValueOnce({
        status: 422,
        message: "Invalid request",
      });

      await expect(githubService.getPullRequest("owner", "repo", 1)).rejects.toThrow(
        GitHubValidationError
      );
    });

    it("should return formatted pull request data", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.pulls.get
        .mockResolvedValueOnce({
          data: {
            title: "Test PR",
            body: "Test body",
            user: { login: "testuser" },
            state: "open",
            html_url: "https://github.com/test",
          },
        })
        .mockResolvedValueOnce({ data: "test diff" });

      const result = await githubService.getPullRequest("owner", "repo", 1);

      expect(result).toEqual({
        title: "Test PR",
        body: "Test body",
        user: "testuser",
        state: "open",
        url: "https://github.com/test",
        diff: expect.any(String),
      });
    });
  });
});
