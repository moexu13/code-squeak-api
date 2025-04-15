import { Hono } from "hono";
import { Context, Next } from "hono";
import { GitHubService } from "./github.service";
import { ClaudeService } from "./claude.service";
import logger from "../utils/logger";

type Variables = {
  apiKey: string;
  repoName: string;
};

const apiRouter = new Hono<{ Variables: Variables }>();

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

apiRouter.get("/:owner/:repoName", async (c: Context) => {
  const { owner, repoName } = c.req.param();
  logger.info(
    {
      owner,
      repoName,
      context: "API Routes",
    },
    "Fetching pull requests"
  );

  const githubService = new GitHubService(c.get("apiKey"), c);
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

apiRouter.get("/:owner/:repoName/pull/:pullNumber/analyze", async (c: Context) => {
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

  const githubService = new GitHubService(c.get("apiKey"), c);
  const claudeService = new ClaudeService();

  try {
    const pullRequest = await githubService.getPullRequest(owner, repoName, parseInt(pullNumber));

    const analysisPrompt = `You are a senior software engineer. Please analyze this GitHub pull request and provide feedback:

Title: ${pullRequest.title}
Description: ${pullRequest.body || "No description provided"}
Author: ${pullRequest.user}
State: ${pullRequest.state}
URL: ${pullRequest.url}

Changes:
${pullRequest.diff}

Please provide:
1. A summary of the changes
2. Potential issues or concerns
3. Suggestions for improvement
4. Whether the pull request should be accepted or rejected`;

    const analysis = await claudeService.sendMessage(analysisPrompt, {
      maxTokens: 2000,
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
        ...pullRequest,
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
