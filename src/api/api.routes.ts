import { Hono } from "hono";
import { Context, Next } from "hono";
import { GitHubService } from "./github.service";

type Variables = {
  apiKey: string;
  owner: string;
  repoName: string;
};

const apiRouter = new Hono<{ Variables: Variables }>();

// Middleware to inject environment variables
apiRouter.use("*", async (c: Context<{ Variables: Variables }>, next: Next) => {
  // Always use process.env in Node.js environment
  const apiKey = process.env.GITHUB_TOKEN;

  console.log("Middleware environment check:", {
    hasProcessToken: !!process.env.GITHUB_TOKEN,
    tokenLength: apiKey?.length,
  });

  if (!apiKey) {
    return c.json(
      {
        error: "GitHub token not configured",
        details: {
          hasProcessToken: !!process.env.GITHUB_TOKEN,
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
  const githubService = new GitHubService(c.get("apiKey"));
  const pullRequests = await githubService.listPullRequests(owner, repoName);

  return c.json({ pullRequests });
});

export default apiRouter;
