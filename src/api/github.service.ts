import { Octokit } from "@octokit/rest";
import { Anthropic } from "@anthropic-ai/sdk";

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
        state: "all", // 'open', 'closed', or 'all'
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
      console.error("GitHub API Error:", error);
      throw new Error(
        `Failed to fetch pull requests: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ClaudeClient {
  private client: Anthropic;

  constructor() {
    const apiKey = import.meta.env.DEV
      ? import.meta.env.VITE_ANTHROPIC_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  // ... rest of the code ...
}
