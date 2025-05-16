import { Context } from "hono";
import { GitHubService } from "../services/github/service";
import { COMMENT_HEADER } from "../types";
import logger from "../../utils/logger";
import { createSuccessResponse } from "../utils/response";
import { analyzePullRequest } from "../services/pull-request/analyzer";

export const listPullRequests = async (c: Context) => {
  const { owner, repoName } = c.req.param();
  logger.info(
    {
      owner,
      repoName,
      context: "API Routes",
    },
    "Fetching pull requests"
  );

  const githubService = new GitHubService();
  const pullRequests = await githubService.listPullRequests(owner, repoName);

  logger.debug(
    {
      owner,
      repoName,
      pullRequestCount: pullRequests.length,
      context: "API Routes",
    },
    "Successfully fetched pull requests"
  );

  return c.json(createSuccessResponse({ pullRequests }));
};

export const analyzePullRequestHandler = async (c: Context) => {
  const { owner, repoName, pullNumber } = c.req.param();

  try {
    const result = await analyzePullRequest(owner, repoName, parseInt(pullNumber), {
      maxTokens: 1000,
      temperature: 0.7,
    });

    return c.json(createSuccessResponse(result));
  } catch (error) {
    logger.error(
      {
        errorType: error instanceof Error ? error.name : "Unknown",
        owner,
        repoName,
        pullNumber,
        context: "API Routes",
      },
      "Failed to analyze pull request"
    );
    throw error;
  }
};

export const analyzeAndCommentPullRequest = async (c: Context) => {
  const { owner, repoName, pullNumber } = c.req.param();
  const requestBody = c.get("validatedBody");
  const shouldPostComment = requestBody.postComment !== false;

  logger.info(
    {
      owner,
      repoName,
      pullNumber,
      shouldPostComment,
      hasCustomPrompt: !!requestBody.prompt,
      maxTokens: requestBody.maxTokens,
      temperature: requestBody.temperature,
      context: "API Routes",
    },
    "Starting pull request analysis and comment"
  );

  try {
    const result = await analyzePullRequest(owner, repoName, parseInt(pullNumber), {
      customPrompt: requestBody.prompt,
      maxTokens: requestBody.maxTokens,
      temperature: requestBody.temperature,
    });

    // Post comment to the PR if requested
    if (shouldPostComment) {
      try {
        const githubService = new GitHubService();
        await githubService.createPullRequestComment(
          owner,
          repoName,
          parseInt(pullNumber),
          `${COMMENT_HEADER}\n\n${result.analysis}`
        );

        logger.info(
          {
            owner,
            repoName,
            pullNumber,
            context: "API Routes",
          },
          "Successfully posted review comment to pull request"
        );

        return c.json({ success: true });
      } catch (commentError) {
        logger.error(
          {
            errorType: commentError instanceof Error ? commentError.name : "Unknown",
            owner,
            repoName,
            pullNumber,
            context: "API Routes",
          },
          "Failed to post comment"
        );
        throw commentError;
      }
    }

    return c.json({ success: true });
  } catch (error) {
    logger.error(
      {
        errorType: error instanceof Error ? error.name : "Unknown",
        owner,
        repoName,
        pullNumber,
        context: "API Routes",
      },
      "Failed to analyze pull request and post comment"
    );
    throw error;
  }
};
