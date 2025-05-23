import { Octokit } from "@octokit/rest";
import logger from "../../utils/logger";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  updated_at: string;
  stargazers_count: number;
  language: string | null;
}

interface PullRequest {
  id: number;
  html_url: string;
  title: string;
  number: number;
  user: {
    login: string;
  };
  comments: number;
  additions: number;
  deletions: number;
  created_at: string;
  updated_at: string;
  body_preview: string | null;
}

class GitHubError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export async function list(owner: string): Promise<Repository[]> {
  const octokit = new Octokit();
  const response = await octokit.repos.listForUser({
    username: owner,
    per_page: 10,
    sort: "updated",
  });

  return response.data.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description ?? null,
    html_url: repo.html_url,
    updated_at: repo.updated_at ?? new Date().toISOString(),
    stargazers_count: repo.stargazers_count ?? 0,
    language: repo.language ?? null,
  }));
}

export async function read(owner: string, repository: string) {
  const octokit = new Octokit();
  const response = await octokit.repos.get({
    owner,
    repo: repository,
    pull_requests: listPullRequests(owner, repository),
  });
  return response.data;
}

async function listPullRequests(
  owner: string,
  repoName: string
): Promise<PullRequest[]> {
  const octokit = new Octokit();
  try {
    const response = await octokit.pulls.list({
      owner,
      repo: repoName,
      state: "open",
      sort: "updated",
      direction: "desc",
    });

    if (!response.data) {
      throw new GitHubError("Empty response from GitHub API", {
        owner,
        repo: repoName,
        status: response.status,
      });
    }

    // Fetch detailed PR data including statistics
    const pullRequests = await Promise.all(
      response.data.map(async (pr) => {
        const details = await octokit.pulls.get({
          owner,
          repo: repoName,
          pull_number: pr.number,
        });

        return {
          id: pr.id,
          html_url: pr.html_url,
          title: pr.title,
          number: pr.number,
          user: {
            login: pr.user?.login ?? "unknown",
          },
          comments: details.data.comments ?? 0,
          additions: details.data.additions ?? 0,
          deletions: details.data.deletions ?? 0,
          created_at: pr.created_at ?? new Date().toISOString(),
          updated_at: pr.updated_at ?? new Date().toISOString(),
          body_preview: pr.body ? pr.body.substring(0, 200) : null,
        };
      })
    );

    return pullRequests;
  } catch (error) {
    logger.error({
      message: "Failed to fetch pull requests from GitHub",
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        owner,
        repo: repoName,
      },
    });

    throw error instanceof GitHubError
      ? error
      : new GitHubError("Failed to fetch pull requests from GitHub", {
          owner,
          repo: repoName,
          originalError: error instanceof Error ? error.message : String(error),
        });
  }
}
