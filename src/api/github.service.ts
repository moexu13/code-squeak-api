import { Octokit } from "@octokit/rest";
import logger from "../utils/logger";

export class GitHubService {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  async listPullRequests(owner: string, repo: string) {
    try {
      const { data: pullRequests } = await this.octokit.pulls.list({
        owner,
        repo,
        state: "open",
        sort: "updated",
        direction: "desc",
      });

      return pullRequests.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        user: pr.user?.login,
      }));
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          owner,
          repo,
          context: "GitHub API Error",
        },
        "Failed to fetch pull requests"
      );
      throw new Error(
        `Failed to fetch pull requests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number) {
    try {
      const { data: pullRequest } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });

      // Get the diff with a limit on size
      const { data: diff } = (await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        mediaType: {
          format: "diff",
        },
      })) as unknown as { data: string };

      // Filter sensitive information and limit size
      const filteredDiff = this.filterDiff(diff);

      return {
        number: pullRequest.number,
        title: pullRequest.title,
        body: pullRequest.body,
        state: pullRequest.state,
        url: pullRequest.html_url,
        createdAt: pullRequest.created_at,
        updatedAt: pullRequest.updated_at,
        user: pullRequest.user?.login,
        diff: filteredDiff,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          owner,
          repo,
          pullNumber,
          context: "GitHub API Error",
        },
        "Failed to fetch pull request"
      );
      throw new Error(
        `Failed to fetch pull request: ${error instanceof Error ? error.message : String(error)}`
      );
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
