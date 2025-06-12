import { describe, it, expect, beforeEach, vi } from "vitest";
import { Octokit } from "@octokit/rest";
import {
  list,
  read,
  create,
  COMMENT_HEADER,
} from "../src/api/github/github.service";
import { GitHubError } from "../src/errors/github";

// Test configuration
const TEST_OWNER = "moexu13";
const TEST_REPO = "code-squeak-api";

// Define types for our mock functions
type MockOctokit = Octokit & {
  __mocks: {
    mockCreateComment: ReturnType<typeof vi.fn>;
    mockListForUser: ReturnType<typeof vi.fn>;
    mockListPulls: ReturnType<typeof vi.fn>;
    mockGetPull: ReturnType<typeof vi.fn>;
  };
};

// Mock the Octokit class
vi.mock("@octokit/rest", () => {
  const mockCreateComment = vi.fn();
  const mockListForUser = vi.fn();
  const mockListPulls = vi.fn();
  const mockGetPull = vi.fn();

  return {
    Octokit: vi.fn().mockImplementation(() => ({
      issues: {
        createComment: mockCreateComment,
      },
      repos: {
        listForUser: mockListForUser,
      },
      pulls: {
        list: mockListPulls,
        get: mockGetPull,
      },
      __mocks: {
        mockCreateComment,
        mockListForUser,
        mockListPulls,
        mockGetPull,
      },
    })),
  };
});

describe("GitHub Service", () => {
  let mockCreateComment: ReturnType<typeof vi.fn>;
  let mockListForUser: ReturnType<typeof vi.fn>;
  let mockListPulls: ReturnType<typeof vi.fn>;
  let mockGetPull: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Get mock functions from the mock implementation
    const octokit = new Octokit() as MockOctokit;
    mockCreateComment = octokit.__mocks.mockCreateComment;
    mockListForUser = octokit.__mocks.mockListForUser;
    mockListPulls = octokit.__mocks.mockListPulls;
    mockGetPull = octokit.__mocks.mockGetPull;

    // Set up default mock responses
    mockCreateComment.mockResolvedValue({
      data: {
        id: 123,
        body: "Test comment",
        created_at: new Date().toISOString(),
      },
    });

    mockListForUser.mockResolvedValue({
      data: [
        {
          id: 1,
          name: "code-squeak-api",
          full_name: "moexu13/code-squeak-api",
          description: "Test repo",
          html_url: "https://github.com/moexu13/code-squeak-api",
          updated_at: new Date().toISOString(),
          stargazers_count: 0,
          language: "TypeScript",
        },
      ],
      headers: {
        link: '<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=2>; rel="last"',
      },
    });

    mockListPulls.mockResolvedValue({
      data: [
        {
          id: 1,
          number: 4,
          title: "Test PR",
          user: { login: "testuser" },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          body: "Test PR body",
        },
      ],
      headers: {
        link: '<https://api.github.com/repos/moexu13/code-squeak-api/pulls?page=2>; rel="next", <https://api.github.com/repos/moexu13/code-squeak-api/pulls?page=2>; rel="last"',
      },
    });

    mockGetPull.mockResolvedValue({
      data: {
        comments: 0,
        additions: 10,
        deletions: 5,
      },
    });
  });

  describe("COMMENT_HEADER", () => {
    it("should be a non-empty string", () => {
      expect(COMMENT_HEADER).toBeDefined();
      expect(typeof COMMENT_HEADER).toBe("string");
      expect(COMMENT_HEADER.length).toBeGreaterThan(0);
    });

    it("should contain the expected emoji", () => {
      expect(COMMENT_HEADER).toContain("🐀");
    });

    it("should contain the expected text", () => {
      expect(COMMENT_HEADER).toContain("CodeSqueak AI Review");
    });
  });

  describe("list", () => {
    it("should list repositories for a user", async () => {
      const response = await list(TEST_OWNER);

      expect(response).toBeDefined();
      expect(response.data).toBeInstanceOf(Array);
      expect(response.pagination).toBeDefined();
      expect(response.pagination.current_page).toBe(1);

      // Check if our test repo is in the list
      const testRepo = response.data.find((repo) => repo.name === TEST_REPO);
      expect(testRepo).toBeDefined();

      // Verify the mock was called correctly
      expect(mockListForUser).toHaveBeenCalledWith({
        username: TEST_OWNER,
        page: 1,
        per_page: 10,
        sort: "updated",
      });
    });

    it("should handle pagination", async () => {
      const response = await list(TEST_OWNER, { page: 1, per_page: 5 });

      expect(response.data.length).toBeLessThanOrEqual(5);
      expect(response.pagination.per_page).toBe(5);

      // Verify the mock was called with pagination params
      expect(mockListForUser).toHaveBeenCalledWith({
        username: TEST_OWNER,
        page: 1,
        per_page: 5,
        sort: "updated",
      });
    });
  });

  describe("read", () => {
    it("should get pull requests for a repository", async () => {
      const prs = await read(TEST_OWNER, TEST_REPO);

      expect(prs).toBeInstanceOf(Array);
      expect(prs.length).toBeGreaterThan(0);

      // Check PR structure
      const pr = prs[0];
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

      // Verify the mocks were called correctly
      expect(mockListPulls).toHaveBeenCalledWith({
        owner: TEST_OWNER,
        repo: TEST_REPO,
        state: "open",
        sort: "updated",
        direction: "desc",
        page: 1,
        per_page: 10,
      });
      expect(mockGetPull).toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should successfully create a comment", async () => {
      const mockParams = {
        owner: "moexu13",
        repoName: "code-squeak-api",
        pullNumber: 4,
      };
      const testComment = "Test comment";

      const mockResponse = {
        data: {
          id: 123,
          body: `${COMMENT_HEADER}\n\n${testComment}`,
        },
      };

      mockCreateComment.mockResolvedValueOnce(mockResponse);

      const result = await create(
        mockParams.owner,
        mockParams.repoName,
        mockParams.pullNumber,
        testComment
      );

      expect(result).toEqual({
        id: 123,
        body: `${COMMENT_HEADER}\n\n${testComment}`,
      });

      // Verify Octokit was called with correct parameters
      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: mockParams.owner,
        repo: mockParams.repoName,
        issue_number: mockParams.pullNumber,
        body: `${COMMENT_HEADER}\n\n${testComment}`,
      });
    });

    it("should throw GitHubError when API call fails", async () => {
      const mockParams = {
        owner: "moexu13",
        repoName: "code-squeak-api",
        pullNumber: 4,
      };
      const testComment = "This should fail";

      mockCreateComment.mockRejectedValueOnce(new Error("API Error"));

      await expect(
        create(
          mockParams.owner,
          mockParams.repoName,
          mockParams.pullNumber,
          testComment
        )
      ).rejects.toThrow(GitHubError);
    });

    it("should throw GitHubError when response data is empty", async () => {
      const mockParams = {
        owner: "moexu13",
        repoName: "code-squeak-api",
        pullNumber: 4,
      };
      const testComment = "This should fail";

      mockCreateComment.mockResolvedValueOnce({
        data: null,
      });

      await expect(
        create(
          mockParams.owner,
          mockParams.repoName,
          mockParams.pullNumber,
          testComment
        )
      ).rejects.toThrow("Failed to create pull request comment");
    });

    it("should throw error for invalid PR number", async () => {
      const mockParams = {
        owner: "moexu13",
        repoName: "code-squeak-api",
        pullNumber: 999999,
      };
      const testComment = "This should fail";

      mockCreateComment.mockRejectedValueOnce(new Error("Not Found"));

      await expect(
        create(
          mockParams.owner,
          mockParams.repoName,
          mockParams.pullNumber,
          testComment
        )
      ).rejects.toThrow("Pull request not found");
    });
  });
});
