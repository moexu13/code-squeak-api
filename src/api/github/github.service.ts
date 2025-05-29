import { Octokit } from "@octokit/rest";
import logger from "../../utils/logger";
import { GitHubError } from "../../errors/github";
import { sanitizeDiff } from "../../utils/sanitize";
import {
  Repository,
  PullRequest,
  PaginationParams,
  PaginatedResponse,
} from "./github.types";
import { StatusError } from "../../errors/status";

// Initialize Octokit with the GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function list(
  owner: string,
  { page = 1, per_page = 10 }: PaginationParams = {}
): Promise<PaginatedResponse<Repository>> {
  const response = await octokit.repos.listForUser({
    username: owner,
    page,
    per_page,
    sort: "updated",
  });

  // Get total count from the Link header if available
  const totalCount = parseInt(
    response.headers.link?.match(/page=(\d+)>; rel="last"/)?.[1] ?? "1",
    10
  );
  const totalPages = Math.ceil(totalCount / per_page);

  return {
    data: response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description ?? null,
      html_url: repo.html_url,
      updated_at: repo.updated_at ?? new Date().toISOString(),
      stargazers_count: repo.stargazers_count ?? 0,
      language: repo.language ?? null,
    })),
    pagination: {
      current_page: page,
      per_page,
      total_count: totalCount,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_previous: page > 1,
    },
  };
}

export async function read(owner: string, repository: string) {
  const pullRequestsResponse = await listPullRequests(owner, repository);
  return pullRequestsResponse.data;
}

async function listPullRequests(
  owner: string,
  repoName: string,
  { page = 1, per_page = 10 }: PaginationParams = {}
): Promise<PaginatedResponse<PullRequest>> {
  try {
    const response = await octokit.pulls.list({
      owner,
      repo: repoName,
      state: "open",
      sort: "updated",
      direction: "desc",
      page,
      per_page,
    });

    if (!response.data) {
      throw new GitHubError("Empty response from GitHub API", {
        owner,
        repo: repoName,
        status: response.status,
      });
    }

    // Get total count from the Link header if available
    const totalCount = parseInt(
      response.headers.link?.match(/page=(\d+)>; rel="last"/)?.[1] ?? "1",
      10
    );
    const totalPages = Math.ceil(totalCount / per_page);

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
          body_preview: pr.body
            ? pr.body
                .replace(/[\n\r]/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 200)
            : null,
        };
      })
    );

    return {
      data: pullRequests,
      pagination: {
        current_page: page,
        per_page,
        total_count: totalCount,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_previous: page > 1,
      },
    };
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

export async function create(
  owner: string,
  repoName: string,
  pullNumber: number,
  body: string
): Promise<void> {
  try {
    const response = await octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: pullNumber,
      body,
    });

    if (!response?.data) {
      throw new Error("Empty response from GitHub API");
    }
  } catch (error) {
    throw new GitHubError("Failed to create pull request comment", {
      owner,
      repo: repoName,
      pullNumber,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getDiff(
  owner: string,
  repoName: string,
  pullNumber: number
) {
  try {
    const response = await octokit.request({
      method: "GET",
      url: `/repos/${owner}/${repoName}/pulls/${pullNumber}`,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    });

    if (!response?.data) {
      throw new Error("Empty response from GitHub API");
    }

    return sanitizeDiff(response.data as string);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Not Found")) {
      throw new StatusError("Pull request not found", 404, {
        owner,
        repo: repoName,
        pullNumber,
      });
    }
    throw new GitHubError("Failed to fetch pull request diff", {
      owner,
      repo: repoName,
      pullNumber,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
