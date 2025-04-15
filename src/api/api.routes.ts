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

export default apiRouter;
