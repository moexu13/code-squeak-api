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

// Validation middleware
const validateParams = async (c: Context, next: Next) => {
  const start = Date.now();
  try {
    return await validatePullRequestParams(c, next);
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        context: "Validation Middleware",
      },
      "Error validating params"
    );
    return c.json({ error: "Invalid parameters", details: error.message }, 400);
  } finally {
    const end = Date.now();
    logger.debug(
      {
        executionTime: `${end - start}ms`,
        context: "Validation Middleware",
      },
      `validateParams middleware executed in ${end - start}ms`
    );
  }
};

// Middleware to inject environment variables
apiRouter.use("*", async (c: Context<{ Variables: Variables }>, next: Next) => {
  const apiKey = process.env.GITHUB_TOKEN;

  logger.debug(
    {
      hasProcessToken: !!process.env.GITHUB_TOKEN,
      tokenLength: apiKey?.length,
      environment: process.env.NODE_ENV,
      context: "API Middleware",
    },
    "Checking GitHub token"
  );

  if (!apiKey) {
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

  if (apiKey.length < 40) {
    logger.error(
      {
        tokenLength: apiKey.length,
        expectedLength: ">= 40",
        context: "API Middleware",
      },
      "GitHub token appears to be invalid (too short)"
    );
    return c.json(
      {
        error: "Invalid GitHub token configuration",
        details: {
          tokenLength: apiKey.length,
          expectedLength: ">= 40",
        },
      },
      500
    );
  }

  c.set("apiKey", apiKey);
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
    const pullRequest = await githubService.getPullRequest(owner, repoName, parseInt(pullNumber));

    // Sanitize pull request data
    const sanitizedData = Sanitizer.sanitizePullRequestData(pullRequest);

    const sanitizedPrompt = DEFAULT_REVIEW_PROMPT.replace("{title}", sanitizedData.title)
      .replace("{description}", sanitizedData.body || "")
      .replace("{author}", sanitizedData.user)
      .replace("{state}", sanitizedData.state)
      .replace("{url}", sanitizedData.url)
      .replace("{diff}", sanitizedData.diff);

    const analysis = await claudeService.sendMessage(sanitizedPrompt, {
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
          ...sanitizedData,
          diff: undefined, // Remove the diff from the response
        },
        analysis,
      })
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
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
  async (c: Context) => {
    const { owner, repoName, pullNumber } = c.req.param();
    const body = await c.req.json();
    const shouldComment = body.postComment !== false;
    const customPrompt = body.prompt;
    const maxTokens = body.maxTokens;
    const temperature = body.temperature;

    logger.info(
      {
        owner,
        repoName,
        pullNumber,
        shouldComment,
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
      const sanitizedData = Sanitizer.sanitizePullRequestData(pullRequestData);
      const sanitizedPrompt = customPrompt
        ? Sanitizer.sanitizePrompt(customPrompt)
        : DEFAULT_REVIEW_PROMPT.replace("{title}", sanitizedData.title)
            .replace("{description}", sanitizedData.body || "")
            .replace("{author}", sanitizedData.user)
            .replace("{state}", sanitizedData.state)
            .replace("{url}", sanitizedData.url)
            .replace("{diff}", sanitizedData.diff);

      // Get analysis from Claude
      const analysis = await claudeService.sendMessage(sanitizedPrompt, {
        maxTokens,
        temperature,
      });

      // Post comment to the PR if requested
      if (shouldComment) {
        try {
          await githubService.createPullRequestComment(
            owner,
            repoName,
            parseInt(pullNumber),
            `${COMMENT_HEADER}\n\n${analysis}`
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
              error: commentError instanceof Error ? commentError.message : String(commentError),
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
          error: error instanceof Error ? error.message : String(error),
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
