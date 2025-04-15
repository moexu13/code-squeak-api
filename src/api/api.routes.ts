import { Hono } from "hono";
import { Context, Next } from "hono";
import { GitHubService } from "./github.service";
import { ClaudeService } from "./claude.service";
import { Sanitizer } from "../utils/sanitizer";
import logger from "../utils/logger";

type Variables = {
  apiKey: string;
  repoName: string;
};

const apiRouter = new Hono<{ Variables: Variables }>();

// Validation middleware
const validateParams = async (c: Context, next: Next) => {
  const { owner, repoName, pullNumber } = c.req.param();

  // Validate owner (GitHub username)
  if (!owner || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(owner)) {
    logger.warn({ owner, context: "API Validation" }, "Invalid owner parameter");
    return c.json(
      {
        error: "Invalid owner parameter",
        details:
          "Owner must be a valid GitHub username (1-39 characters, alphanumeric or hyphen, cannot start or end with hyphen)",
      },
      400
    );
  }

  // Validate repository name
  if (!repoName || !/^[a-zA-Z0-9_.-]{1,100}$/.test(repoName)) {
    logger.warn({ repoName, context: "API Validation" }, "Invalid repository name");
    return c.json(
      {
        error: "Invalid repository name",
        details:
          "Repository name must be 1-100 characters and contain only alphanumeric, underscore, hyphen, or period",
      },
      400
    );
  }

  // Validate pull request number if present
  if (pullNumber) {
    const pullNum = parseInt(pullNumber, 10);
    if (isNaN(pullNum) || pullNum <= 0) {
      logger.warn({ pullNumber, context: "API Validation" }, "Invalid pull request number");
      return c.json(
        {
          error: "Invalid pull request number",
          details: "Pull request number must be a positive integer",
        },
        400
      );
    }
  }

  await next();
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

// API routes
apiRouter.get("/", (c: Context) => {
  logger.info({ context: "API Routes" }, "Root endpoint accessed");
  return c.text("API is running");
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

  const githubService = new GitHubService(c.get("apiKey"));
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

  return c.json({ pullRequests });
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

  const githubService = new GitHubService(c.get("apiKey"));
  const claudeService = new ClaudeService();

  try {
    const pullRequest = await githubService.getPullRequest(owner, repoName, parseInt(pullNumber));

    // Sanitize pull request data
    const sanitizedData = Sanitizer.sanitizePullRequestData(pullRequest);

    const analysisPrompt =
      Sanitizer.sanitizePrompt(`You are a senior software engineer reviewing a pull request. Please analyze the following changes and provide focused feedback:

Title: ${sanitizedData.title}
Description: ${sanitizedData.body || "No description provided"}
Author: ${sanitizedData.user}
State: ${sanitizedData.state}
URL: ${sanitizedData.url}

Changes:
${sanitizedData.diff}

Please provide a concise analysis focusing on:
1. Code quality and maintainability
2. Potential bugs or edge cases
3. Security implications
4. Performance considerations

Keep the analysis focused on the technical aspects of the changes.`);

    const analysis = await claudeService.sendMessage(analysisPrompt, {
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

    return c.json({
      pullRequest: {
        ...sanitizedData,
        diff: undefined, // Remove the diff from the response
      },
      analysis,
    });
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

export default apiRouter;
