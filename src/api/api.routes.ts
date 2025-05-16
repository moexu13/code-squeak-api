import { Hono } from "hono";
import { Variables } from "./types";
import {
  injectEnvironmentVariables,
  validateParams,
  validateAnalyzeAndCommentBody,
} from "./middleware";
import { createSuccessResponse } from "./utils/response";
import {
  listPullRequests,
  analyzePullRequestHandler,
  analyzeAndCommentPullRequest,
} from "./routes/pull-requests";
import logger from "../utils/logger";

const apiRouter = new Hono<{ Variables: Variables }>();

// Middleware to inject environment variables
apiRouter.use("*", injectEnvironmentVariables);

// API routes
apiRouter.get("/", (c) => {
  logger.info({ context: "API Routes" }, "Root endpoint accessed");
  return c.json(createSuccessResponse({ message: "API is running" }));
});

apiRouter.get("/:owner/:repoName", validateParams, listPullRequests);

apiRouter.get(
  "/:owner/:repoName/pull/:pullNumber/analyze",
  validateParams,
  analyzePullRequestHandler
);

apiRouter.post(
  "/:owner/:repoName/pull/:pullNumber/analyze-and-comment",
  validateParams,
  validateAnalyzeAndCommentBody,
  analyzeAndCommentPullRequest
);

export default apiRouter;
