import { Octokit } from "@octokit/rest";
import logger from "../utils/logger";
import {
  GitHubError,
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubValidationError,
} from "../utils/githubErrors";
import { RedisService } from "./redis.service";

export class GitHubService {
  private octokit: Octokit;
  private readonly CACHE_TTL = 5 * 60; // 5 minutes in seconds
  private redis: RedisService;

  constructor() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new GitHubAuthenticationError();
    }

    this.octokit = new Octokit({
      auth: token,
    });
    this.redis = RedisService.getInstance();
  }

  private getCacheKey(method: string, ...args: any[]): string {
    return `github:${method}:${args.join(":")}`;
  }

  private handleGitHubError(error: any, context: string): never {
    logger.error({ error, context }, "GitHub API error occurred");

    if (error.status === 403 && error.message?.includes("rate limit")) {
      const retryAfter = error.response?.headers?.["retry-after"];
      throw new GitHubRateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
    }

    if (error.status === 401 || error.status === 403) {
      throw new GitHubAuthenticationError();
    }

    if (error.status === 404) {
      throw new GitHubNotFoundError(context);
    }

    if (error.status === 422) {
      throw new GitHubValidationError(error.message);
    }

    throw new GitHubError(error.message || "Unexpected GitHub API error");
  }

  async listPullRequests(owner: string, repo: string): Promise<any[]> {
    const cacheKey = this.getCacheKey("listPullRequests", owner, repo);
    const cached = await this.redis.get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.octokit.pulls.list({
        owner,
        repo,
        state: "open",
        sort: "updated",
        direction: "desc",
      });

      await this.redis.set(cacheKey, response.data, this.CACHE_TTL);
      return response.data;
    } catch (error) {
      this.handleGitHubError(error, `listPullRequests(${owner}/${repo})`);
    }
  }

  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<{
    title: string;
    body: string | null;
    user: string;
    state: string;
    url: string;
    diff: string;
  }> {
    const cacheKey = this.getCacheKey("getPullRequest", owner, repo, pullNumber.toString());
    const cached = await this.redis.get<{
      title: string;
      body: string | null;
      user: string;
      state: string;
      url: string;
      diff: string;
    }>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      // Get the diff
      const { data: diff } = (await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        mediaType: {
          format: "diff",
        },
      })) as unknown as { data: string };

      const result = {
        title: response.data.title,
        body: response.data.body,
        user: response.data.user?.login || "unknown",
        state: response.data.state,
        url: response.data.html_url,
        diff: this.filterDiff(diff),
      };

      await this.redis.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      this.handleGitHubError(error, `getPullRequest(${owner}/${repo}#${pullNumber})`);
    }
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
}
