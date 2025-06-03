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
import { getCached, setCached, generateCacheKey } from "../../utils/cache";

// Initialize Octokit with the GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const CACHE_PREFIX = "github:repos";
const PR_CACHE_PREFIX = "github:pulls";
const PR_DETAILS_CACHE_PREFIX = "github:pr-details";
const DIFF_CACHE_PREFIX = "github:diff";

export async function list(
  owner: string,
  { page = 1, per_page = 10 }: PaginationParams = {}
): Promise<PaginatedResponse<Repository>> {
  // Generate cache key based on owner and pagination params
  const cacheKey = generateCacheKey(CACHE_PREFIX, { owner, page, per_page });

  // Try to get cached data
  const cached = await getCached<PaginatedResponse<Repository>>(cacheKey);
  if (cached) {
    logger.info({
      message: "Cache hit for repository list",
      owner,
      page,
      per_page,
    });
    return cached;
  }

  // If not in cache, fetch from GitHub API
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

  const result = {
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

  // Cache the result
  await setCached(cacheKey, result);

  return result;
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
    // Generate cache key for the PR list
    const listCacheKey = generateCacheKey(PR_CACHE_PREFIX, {
      owner,
      repo: repoName,
      page,
      per_page,
    });

    // Try to get cached PR list
    const cachedList = await getCached<PaginatedResponse<PullRequest>>(
      listCacheKey
    );
    if (cachedList) {
      logger.info({
        message: "Cache hit for pull request list",
        owner,
        repo: repoName,
        page,
        per_page,
      });
      return cachedList;
    }

    // If not in cache, fetch from GitHub API
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
        // Generate cache key for individual PR details
        const detailsCacheKey = generateCacheKey(PR_DETAILS_CACHE_PREFIX, {
          owner,
          repo: repoName,
          number: pr.number,
        });

        // Try to get cached PR details
        const cachedDetails = await getCached<{
          comments: number;
          additions: number;
          deletions: number;
          body_preview: string | null;
        }>(detailsCacheKey);

        let details;
        if (cachedDetails) {
          logger.info({
            message: "Cache hit for pull request details",
            owner,
            repo: repoName,
            number: pr.number,
          });
          details = cachedDetails;
        } else {
          // If not in cache, fetch from GitHub API
          const detailsResponse = await octokit.pulls.get({
            owner,
            repo: repoName,
            pull_number: pr.number,
          });

          // Create body preview by removing newlines and extra spaces
          const bodyPreview = detailsResponse.data.body
            ? detailsResponse.data.body
                .replace(/[\n\r]/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 200)
            : null;

          details = {
            comments: detailsResponse.data.comments ?? 0,
            additions: detailsResponse.data.additions ?? 0,
            deletions: detailsResponse.data.deletions ?? 0,
            body_preview: bodyPreview,
          };
          // Cache the PR details with a shorter TTL (2 minutes)
          await setCached(detailsCacheKey, details, 120);
        }

        return {
          id: pr.id,
          html_url: pr.html_url,
          title: pr.title,
          number: pr.number,
          user: {
            login: pr.user?.login ?? "unknown",
          },
          comments: details.comments,
          additions: details.additions,
          deletions: details.deletions,
          created_at: pr.created_at ?? new Date().toISOString(),
          updated_at: pr.updated_at ?? new Date().toISOString(),
          body_preview: details.body_preview,
        };
      })
    );

    const result = {
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

    // Cache the full PR list with a shorter TTL (2 minutes)
    await setCached(listCacheKey, result, 120);

    return result;
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
    // Generate cache key for the diff
    const diffCacheKey = generateCacheKey(DIFF_CACHE_PREFIX, {
      owner,
      repo: repoName,
      number: pullNumber,
    });

    // Try to get cached diff
    const cachedDiff = await getCached<string>(diffCacheKey);
    if (cachedDiff) {
      logger.info({
        message: "Cache hit for pull request diff",
        owner,
        repo: repoName,
        number: pullNumber,
      });
      return cachedDiff;
    }

    // If not in cache, fetch from GitHub API
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

    const sanitizedDiff = sanitizeDiff(response.data as string);

    // Cache the sanitized diff with a short TTL (1 minute)
    // We use a shorter TTL for diffs since they can change frequently
    await setCached(diffCacheKey, sanitizedDiff, 60);

    return sanitizedDiff;
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
