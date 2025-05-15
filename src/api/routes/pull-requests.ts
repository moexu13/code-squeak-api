import { Context } from "hono";
import { GitHubService } from "../services/github/service";
import { ClaudeService } from "../services/claude/service";
import { Sanitizer } from "../../utils/sanitizer";
import logger from "../../utils/logger";
import { createSuccessResponse } from "../utils/response";
import { DEFAULT_REVIEW_PROMPT, COMMENT_HEADER } from "../types";

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

export const analyzePullRequest = async (c: Context) => {
  const { owner, repoName, pullNumber } = c.req.param();
  logger.info(
    {
      owner,
      repoName,
      pullNumber,
      context: "API Routes",
    },
    "Analyzing pull request"
  );

  const githubService = new GitHubService();
  const claudeService = new ClaudeService();

  try {
    const pullRequestData = await githubService.getPullRequest(
      owner,
      repoName,
      parseInt(pullNumber)
    );

    // Sanitize pull request data
    const sanitizedPullRequest = Sanitizer.sanitizePullRequestData(pullRequestData);

    const formattedPrompt = DEFAULT_REVIEW_PROMPT.replace("{title}", sanitizedPullRequest.title)
      .replace("{description}", sanitizedPullRequest.body || "")
      .replace("{author}", sanitizedPullRequest.user)
      .replace("{state}", sanitizedPullRequest.state)
      .replace("{url}", sanitizedPullRequest.url)
      .replace("{diff}", sanitizedPullRequest.diff);

    const analysisResult = await claudeService.sendMessage(formattedPrompt, {
      maxTokens: 1000,
      temperature: 0.7,
    });

    logger.debug(
      {
        owner,
        repoName,
        pullNumber,
        context: "API Routes",
      },
      "Successfully analyzed pull request"
    );

    return c.json(
      createSuccessResponse({
        pullRequest: {
          ...sanitizedPullRequest,
          diff: undefined, // Remove the diff from the response
        },
        analysis: analysisResult,
      })
    );
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
  const customPrompt = requestBody.prompt;
  const maxTokens = requestBody.maxTokens;
  const temperature = requestBody.temperature;

  logger.info(
    {
      owner,
      repoName,
      pullNumber,
      shouldPostComment,
      hasCustomPrompt: !!customPrompt,
      maxTokens,
      temperature,
      context: "API Routes",
    },
    "Starting pull request analysis and comment"
  );

  try {
    const githubService = new GitHubService();
    const claudeService = new ClaudeService();

    // Get pull request data
    const pullRequestData = await githubService.getPullRequest(
      owner,
      repoName,
      parseInt(pullNumber)
    );

    // Sanitize the data
    const sanitizedPullRequest = Sanitizer.sanitizePullRequestData(pullRequestData);
    const formattedPrompt = customPrompt
      ? Sanitizer.sanitizePrompt(customPrompt)
      : DEFAULT_REVIEW_PROMPT.replace("{title}", sanitizedPullRequest.title)
          .replace("{description}", sanitizedPullRequest.body || "")
          .replace("{author}", sanitizedPullRequest.user)
          .replace("{state}", sanitizedPullRequest.state)
          .replace("{url}", sanitizedPullRequest.url)
          .replace("{diff}", sanitizedPullRequest.diff);

    // Get analysis from Claude
    const analysisResult = await claudeService.sendMessage(formattedPrompt, {
      maxTokens,
      temperature,
    });

    // Post comment to the PR if requested
    if (shouldPostComment) {
      try {
        await githubService.createPullRequestComment(
          owner,
          repoName,
          parseInt(pullNumber),
          `${COMMENT_HEADER}\n\n${analysisResult}`
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
