import { Octokit } from "@octokit/rest";
import { GitHubAuthenticationError } from "../../../utils/githubErrors";
import { CircuitBreaker } from "../../../utils/circuitBreaker";
import { getGitHubConfig } from "./config";
import { handleGitHubError } from "./error-handler";
import { GitHubCache } from "./cache";
import { PullRequest } from "./types";
import logger from "../../../utils/logger";

export class GitHubService {
  private octokit: Octokit;
  private cache: GitHubCache;
  private circuitBreaker: CircuitBreaker;
  private config: ReturnType<typeof getGitHubConfig>;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new GitHubAuthenticationError();
    }

    this.octokit = new Octokit({
      auth: token,
    });

    this.config = getGitHubConfig();
    this.cache = new GitHubCache(this.config);
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerFailures,
      this.config.circuitBreakerResetTime
    );
  }

  async listPullRequests(owner: string, repoName: string): Promise<any[]> {
    const cacheKey = this.cache.getCacheKey("listPullRequests", owner, repoName);
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const result = await this.circuitBreaker.execute(async () => {
      try {
        const response = await this.octokit.pulls.list({
          owner,
          repo: repoName,
          state: "open",
          sort: "updated",
          direction: "desc",
        });

        if (!response.data) {
          throw new Error("Empty response from GitHub API");
        }

        const pullRequests = response.data;
        await this.cache.set(cacheKey, pullRequests);
        return pullRequests;
      } catch (error) {
        handleGitHubError(error, `listPullRequests(${owner}/${repoName})`);
      }
    });

    if (!result) {
      throw new Error("Failed to fetch pull requests");
    }

    return result;
  }

  async getPullRequest(owner: string, repoName: string, pullNumber: number): Promise<PullRequest> {
    const cacheKey = this.cache.getCacheKey(
      "getPullRequest",
      owner,
      repoName,
      pullNumber.toString()
    );
    const cached = await this.cache.get<PullRequest>(cacheKey);
    if (cached) return cached;

    const result = await this.circuitBreaker.execute(async () => {
      try {
        const response = await this.octokit.pulls.get({
          owner,
          repo: repoName,
          pull_number: pullNumber,
        });

        if (!response.data) {
          throw new Error("Empty response from GitHub API");
        }

        // Get the diff
        const { data: diff } = (await this.octokit.pulls.get({
          owner,
          repo: repoName,
          pull_number: pullNumber,
          mediaType: {
            format: "diff",
          },
        })) as unknown as { data: string };

        const result: PullRequest = {
          title: response.data.title,
          body: response.data.body,
          user: response.data.user?.login || "unknown",
          state: response.data.state,
          url: response.data.html_url,
          diff: this.filterDiff(diff),
        };

        await this.cache.set(cacheKey, result);
        return result;
      } catch (error) {
        handleGitHubError(error, `getPullRequest(${owner}/${repoName}#${pullNumber})`);
      }
    });

    if (!result) {
      throw new Error("Failed to fetch pull request");
    }

    return result;
  }

  private filterDiff(diff: string): string {
    // Limit the diff size to 10KB
    const MAX_DIFF_SIZE = 10 * 1024;
    if (diff.length > MAX_DIFF_SIZE) {
      diff = diff.substring(0, MAX_DIFF_SIZE) + "\n... (diff truncated)";
    }

    // Remove sensitive patterns
    const sensitivePatterns = [
      /api[_-]?key["']?\s*[:=]\s*["'][^"']+["']/gi,
      /secret["']?\s*[:=]\s*["'][^"']+["']/gi,
      /password["']?\s*[:=]\s*["'][^"']+["']/gi,
      /token["']?\s*[:=]\s*["'][^"']+["']/gi,
      /credential["']?\s*[:=]\s*["'][^"']+["']/gi,
    ];

    sensitivePatterns.forEach((pattern) => {
      diff = diff.replace(pattern, "[REDACTED]");
    });

    return diff;
  }

  async createPullRequestComment(
    owner: string,
    repoName: string,
    pullNumber: number,
    body: string
  ): Promise<void> {
    return this.circuitBreaker.execute(async () => {
      try {
        logger.debug(
          {
            owner,
            repoName,
            pullNumber,
            bodyLength: body.length,
            context: "GitHubService",
          },
          "Creating pull request comment"
        );

        const response = await this.octokit.issues.createComment({
          owner,
          repo: repoName,
          issue_number: pullNumber, // Pull requests are treated as issues in the GitHub API
          body,
        });

        if (!response?.data) {
          throw new Error("Empty response from GitHub API");
        }

        logger.info(
          { owner, repoName, pullNumber, commentId: response.data.id },
          "Successfully created comment on pull request"
        );
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            owner,
            repoName,
            pullNumber,
            context: "GitHubService",
          },
          "Failed to create pull request comment"
        );
        handleGitHubError(error, `createPullRequestComment(${owner}/${repoName}#${pullNumber})`);
      }
    });
  }
}
