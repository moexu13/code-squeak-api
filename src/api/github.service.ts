import { Octokit } from "@octokit/rest";
import { Anthropic } from "@anthropic-ai/sdk";
import { Context } from "hono";
import logger from "../utils/logger";

export class GitHubService {
  private octokit: Octokit;
  private context: Context;

  constructor(token: string, context: Context) {
    this.context = context;
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
}

interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ClaudeClient {
  private client: Anthropic;
  private context: Context;

  constructor(context: Context) {
    this.context = context;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  // ... rest of the code ...
}
