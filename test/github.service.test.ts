import { describe, it, expect, beforeAll } from "vitest";
import { GitHubService } from "../src/api/github.service";
import { config } from "dotenv";
import { Context } from "hono";

describe("GitHubService", () => {
  let githubService: GitHubService;
  const mockContext = {
    error: console.error,
    log: console.log,
  } as unknown as Context;

  beforeAll(() => {
    // Load environment variables from .env file
    config();

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is required for tests");
    }
    githubService = new GitHubService(token, mockContext);
  });

  it("should be able to fetch pull requests from a public repository", async () => {
    const pullRequests = await githubService.listPullRequests("octocat", "Hello-World");

    expect(pullRequests).toBeInstanceOf(Array);
    expect(pullRequests[0]).toHaveProperty("number");
    expect(pullRequests[0]).toHaveProperty("title");
    expect(pullRequests[0]).toHaveProperty("state");
    expect(pullRequests[0]).toHaveProperty("url");
  });

  it("should handle non-existent repositories", async () => {
    await expect(githubService.listPullRequests("nonexistent", "nonexistent")).rejects.toThrow();
  });
});
