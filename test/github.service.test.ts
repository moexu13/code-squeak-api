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
      // Mock the first call to get the PR data
      octokitInstance.pulls.get.mockRejectedValueOnce({ status: 401 });
      // Mock the second call to get the diff (which won't be reached due to the error)
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

  describe("createPullRequestComment", () => {
    // Update our vi.mock to include issues.createComment
    beforeEach(() => {
      vi.resetAllMocks();

      // Set up GitHub token for each test
      process.env.GITHUB_TOKEN = "test-token";
      githubService = new GitHubService();

      // Make sure the mocked Octokit instance has the issues.createComment method
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      if (!octokitInstance.issues) {
        octokitInstance.issues = { createComment: vi.fn() };
      } else if (!octokitInstance.issues.createComment) {
        octokitInstance.issues.createComment = vi.fn();
      }
    });

    it("should create a pull request comment successfully", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.issues.createComment.mockResolvedValueOnce({ data: {} });

      await githubService.createPullRequestComment("owner", "repo", 1, "Test comment");

      expect(octokitInstance.issues.createComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
        body: "Test comment",
      });
    });

    it("should handle authentication errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.issues.createComment.mockRejectedValueOnce({ status: 401 });

      await expect(
        githubService.createPullRequestComment("owner", "repo", 1, "Test comment")
      ).rejects.toThrow(GitHubAuthenticationError);
    });

    it("should handle rate limit errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.issues.createComment.mockRejectedValueOnce({
        status: 403,
        message: "rate limit exceeded",
        response: { headers: { "retry-after": "60" } },
      });

      await expect(
        githubService.createPullRequestComment("owner", "repo", 1, "Test comment")
      ).rejects.toThrow(GitHubRateLimitError);
    });

    it("should handle not found errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.issues.createComment.mockRejectedValueOnce({ status: 404 });

      await expect(
        githubService.createPullRequestComment("owner", "repo", 1, "Test comment")
      ).rejects.toThrow(GitHubNotFoundError);
    });

    it("should handle validation errors", async () => {
      const octokitInstance = vi.mocked(Octokit).mock.results[0].value;
      octokitInstance.issues.createComment.mockRejectedValueOnce({
        status: 422,
        message: "Invalid request",
      });

      await expect(
        githubService.createPullRequestComment("owner", "repo", 1, "Test comment")
      ).rejects.toThrow(GitHubValidationError);
    });
  });
});
