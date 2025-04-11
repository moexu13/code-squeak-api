import { Hono } from "hono";
import { Context, Next } from "hono";
import { GitHubService } from "./github.service";
import { ClaudeService } from "./claude.service";

type Variables = {
  apiKey: string;
  repoName: string;
};

const apiRouter = new Hono<{ Variables: Variables }>();

// Middleware to inject environment variables
apiRouter.use("*", async (c: Context<{ Variables: Variables }>, next: Next) => {
  const apiKey = process.env.GITHUB_TOKEN;

  // Safely log if c.log is available
  if (typeof c.log === "function") {
    c.log("Middleware environment check:", {
      hasProcessToken: !!process.env.GITHUB_TOKEN,
      tokenLength: apiKey?.length,
      environment: process.env.NODE_ENV,
    });
  }

  if (!apiKey) {
    if (typeof c.log === "function") {
      c.log("Error: GitHub token not found in environment variables");
    }
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
    if (typeof c.log === "function") {
      c.log("Error: GitHub token appears to be invalid (too short)");
    }
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
  return c.text("API is running");
});

apiRouter.get("/:owner/:repoName", async (c: Context) => {
  const { owner, repoName } = c.req.param();
  const githubService = new GitHubService(c.get("apiKey"), c);
  const pullRequests = await githubService.listPullRequests(owner, repoName);

  return c.json({ pullRequests });
});

export default apiRouter;
