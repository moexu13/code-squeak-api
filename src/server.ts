import { config } from "./config/env";
import ViteExpress from "vite-express";
import logger from "./utils/logger";

import githubRouter from "./api/github/github.routes";
import webhooksRouter from "./api/webhooks/webhooks.routes";
import analysisRouter from "./api/analysis/analysis.routes";

logger.info({
  message: "Analysis router imported successfully",
  routerType: typeof analysisRouter,
  isFunction: typeof analysisRouter === "function",
  isRouter: analysisRouter && typeof analysisRouter.use === "function",
});
import errorHandler from "./errors/errorHandler";
import { NotFoundError } from "./errors/http";
import authMiddleware from "./middleware/auth";
import app from "./app";

// Allow access to the root route
app.get("/", (_, res) => {
  res.send("Code Squeak API");
});

// All other routes require an API key
logger.info({
  message: "Mounting routes with auth middleware",
});

app.use("/api/v1/github", authMiddleware, githubRouter);
logger.info({
  message: "GitHub routes mounted",
});

logger.info({
  message: "About to mount analysis router",
  routerType: typeof analysisRouter,
  routerKeys: analysisRouter ? Object.keys(analysisRouter) : "null",
});
app.use("/api/v1/code-analysis", authMiddleware, analysisRouter);
logger.info({
  message: "Analysis routes mounted successfully",
});

app.use("/api/v1/webhooks", authMiddleware, webhooksRouter);
logger.info({
  message: "Webhook routes mounted",
});

logger.info({
  message: "Routes registered",
  routes: ["/api/v1/github", "/api/v1/code-analysis", "/api/v1/webhooks"],
});

// And if there are problems handle them here
app.use((req, _res, next) => {
  logger.warn({
    message: "Route not found - 404 handler reached",
    url: req.originalUrl,
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl,
    routePath: req.route?.path,
    stack: new Error().stack?.split("\n").slice(1, 5), // Show call stack
    headers: {
      authorization: req.headers.authorization ? "present" : "missing",
      "content-type": req.headers["content-type"],
      "user-agent": req.headers["user-agent"],
    },
  });
  next(new NotFoundError(`Not found: ${req.originalUrl}`));
});
app.use(errorHandler);

ViteExpress.listen(app, config.server.port, () =>
  logger.info({
    message: `Server is listening on port ${config.server.port}...`,
  })
);
