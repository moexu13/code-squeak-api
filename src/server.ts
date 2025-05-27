import { config } from "./config/env";
import ViteExpress from "vite-express";
import logger from "./utils/logger";

import analysisRouter from "./api/analysis/analysis.router";
import githubRouter from "./api/github/github.routes";
import errorHandler from "./errors/errorHandler";
import { NotFoundHandler } from "./errors/handlers";
import authMiddleware from "./middleware/auth";
import app from "./app";

// Allow access to the root route
app.get("/", (_, res) => {
  res.send("Code Squeak API");
});

// All other routes require an API key
app.use("/api/v1", authMiddleware);
app.use("/api/v1/github", githubRouter);
app.use("/api/v1/code-analysis", analysisRouter);

// And if there are problems handle them here
app.use(NotFoundHandler.handle);
app.use(errorHandler);

ViteExpress.listen(app, config.server.port, () =>
  logger.info({
    message: `Server is listening on port ${config.server.port}...`,
  })
);
