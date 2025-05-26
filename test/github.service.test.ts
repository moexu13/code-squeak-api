import { describe, it, expect, beforeEach, vi } from "vitest";
import { Octokit } from "@octokit/rest";
import { createPullRequestComment } from "../src/api/github/github.service";
import { GitHubError } from "../src/errors/github";

// Mock the Octokit class
vi.mock("@octokit/rest");

describe("GitHub Service", () => {
  let mockOctokit: {
    issues: {
      createComment: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Create a mock implementation of Octokit
    mockOctokit = {
      issues: {
        createComment: vi.fn(),
      },
    };

    // Set up the mock constructor
    vi.mocked(Octokit).mockImplementation(() => mockOctokit as any);
  });

  describe("createPullRequestComment", () => {
    const mockParams = {
      owner: "test-owner",
      repoName: "test-repo",
      pullNumber: 123,
      body: "Test comment",
    };

    it("should successfully create a comment", async () => {
      // Mock successful API response
      mockOctokit.issues.createComment.mockResolvedValue({
        data: { id: 456 },
      });

      await createPullRequestComment(
        mockParams.owner,
        mockParams.repoName,
        mockParams.pullNumber,
        mockParams.body
      );

      // Verify Octokit was called with correct parameters
      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: mockParams.owner,
        repo: mockParams.repoName,
        issue_number: mockParams.pullNumber,
        body: mockParams.body,
      });
    });

    it("should throw GitHubError when API call fails", async () => {
      // Mock API error
      const apiError = new Error("API Error");
      mockOctokit.issues.createComment.mockRejectedValue(apiError);

      await expect(
        createPullRequestComment(
          mockParams.owner,
          mockParams.repoName,
          mockParams.pullNumber,
          mockParams.body
        )
      ).rejects.toThrow(GitHubError);

      // Verify Octokit was called
      expect(mockOctokit.issues.createComment).toHaveBeenCalled();
    });

    it("should throw GitHubError when response data is empty", async () => {
      // Mock empty response
      mockOctokit.issues.createComment.mockResolvedValue({
        data: null,
      });

      await expect(
        createPullRequestComment(
          mockParams.owner,
          mockParams.repoName,
          mockParams.pullNumber,
          mockParams.body
        )
      ).rejects.toThrow("Failed to create pull request comment");
    });
  });
});
