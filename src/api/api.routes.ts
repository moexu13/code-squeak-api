import { Hono } from "hono";
import { Context, Next } from "hono";
import { GitHubService } from "./github.service";
import { ClaudeService } from "./claude.service";
import { Sanitizer } from "../utils/sanitizer";
import logger from "../utils/logger";
import { validatePullRequestParams } from "../utils/validator";

type Variables = {
  apiKey: string;
  repoName: string;
};

const apiRouter = new Hono<{ Variables: Variables }>();

const DEFAULT_REVIEW_PROMPT = `You are a senior software engineer reviewing a pull request. Please analyze the following changes and provide focused feedback:

Title: {title}
Description: {description}
Author: {author}
State: {state}
URL: {url}

Changes:
{diff}

Please provide a concise analysis focusing on:
1. Code quality and maintainability
2. Idiomatic code and adherence to best practices
3. Potential bugs or edge cases
4. Security implications
5. Performance considerations

Keep the analysis focused on the technical aspects of the changes. Suggest improvements 
and explain your reasoning for each suggestion.`;

const COMMENT_HEADER = "🐀 CodeSqueak AI Review";

// Define types for request bodies
type AnalyzeAndCommentRequestBody = {
  postComment?: boolean;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
};

// Validation middleware
const validateParams = async (c: Context, next: Next) => {
  const startTime = Date.now();
  try {
    return await validatePullRequestParams(c, next);
  } catch (error: any) {
    logger.error(
      {
        errorType: error.name,
        context: "Validation Middleware",
      },
      "Error validating params"
    );
    return c.json({ error: "Invalid parameters" }, 400);
  } finally {
    const endTime = Date.now();
    logger.debug(
      {
        executionTime: `${endTime - startTime}ms`,
        context: "Validation Middleware",
      },
      `validateParams middleware executed in ${endTime - startTime}ms`
    );
  }
};

// Middleware to inject environment variables
apiRouter.use("*", async (c: Context<{ Variables: Variables }>, next: Next) => {
  const githubToken = process.env.GITHUB_TOKEN;

  logger.debug(
    {
      hasProcessToken: !!process.env.GITHUB_TOKEN,
      tokenLength: githubToken?.length,
      environment: process.env.NODE_ENV,
      context: "API Middleware",
    },
    "Checking GitHub token"
  );

  if (!githubToken) {
    logger.error(
      {
        hasProcessToken: false,
        environment: process.env.NODE_ENV,
        context: "API Middleware",
      },
      "GitHub token not found in environment variables"
    );
    return c.json(
      {
        error: "GitHub token not configured",
        details: {
          hasProcessToken: false,
          environment: process.env.NODE_ENV,
        },
      },
      500
    );
  }

  if (githubToken.length < 40) {
    logger.error(
      {
        tokenLength: githubToken.length,
        expectedLength: ">= 40",
        context: "API Middleware",
      },
      "GitHub token appears to be invalid (too short)"
    );
    return c.json(
      {
        error: "Invalid GitHub token configuration",
        details: {
          tokenLength: githubToken.length,
          expectedLength: ">= 40",
        },
      },
      500
    );
  }

  c.set("apiKey", githubToken);
  await next();
});

// Standardize response format
const createSuccessResponse = (data: any = {}) => ({
  success: true,
  ...data,
});

const createErrorResponse = (error: string, details?: any) => ({
  success: false,
  error,
  ...(details && { details }),
});

// Add validation middleware for analyze-and-comment request body
const validateAnalyzeAndCommentBody = async (c: Context, next: Next) => {
  const requestBody = await c.req.json();

  // Validate postComment
  if (requestBody.postComment !== undefined && typeof requestBody.postComment !== "boolean") {
    return c.json({ error: "postComment must be a boolean value" }, 400);
  }

  // Validate prompt if provided
  if (requestBody.prompt !== undefined && typeof requestBody.prompt !== "string") {
    return c.json({ error: "prompt must be a string" }, 400);
  }

  // Validate maxTokens if provided
  if (requestBody.maxTokens !== undefined) {
    if (
      typeof requestBody.maxTokens !== "number" ||
      !Number.isInteger(requestBody.maxTokens) ||
      requestBody.maxTokens <= 0
    ) {
      return c.json({ error: "maxTokens must be a positive integer" }, 400);
    }
  }

  // Validate temperature if provided
  if (requestBody.temperature !== undefined) {
    if (
      typeof requestBody.temperature !== "number" ||
      requestBody.temperature < 0 ||
      requestBody.temperature > 1
    ) {
      return c.json({ error: "temperature must be a number between 0 and 1" }, 400);
    }
  }

  // Store the validated body in the context for the route handler to use
  c.set("validatedBody", requestBody);
  return next();
};

// API routes
apiRouter.get("/", (c: Context) => {
  logger.info({ context: "API Routes" }, "Root endpoint accessed");
  return c.json(createSuccessResponse({ message: "API is running" }));
});

apiRouter.get("/:owner/:repoName", validateParams, async (c: Context) => {
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
});

apiRouter.get("/:owner/:repoName/pull/:pullNumber/analyze", validateParams, async (c: Context) => {
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
});

apiRouter.post(
  "/:owner/:repoName/pull/:pullNumber/analyze-and-comment",
  validateParams,
  validateAnalyzeAndCommentBody,
  async (c: Context) => {
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
  }
);

export default apiRouter;
