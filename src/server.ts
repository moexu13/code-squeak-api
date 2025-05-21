import * as Sentry from "@sentry/node";
import { config } from "./config/env";

// Initialize Sentry first
Sentry.init({
  dsn: config.sentry.dsn,
  environment: config.sentry.environment,
  tracesSampleRate: 1.0,
});

// Import Express after Sentry initialization
import express from "express";
import ViteExpress from "vite-express";
import logger from "./utils/logger";

import analysisRouter from "./api/analysis/analysis.router";
import errorHandler from "./errors/errorHandler";
import notFound from "./errors/notFound";
import authMiddleware from "./middleware/auth";

const app = express();

app.use(express.json());

// Allow access to the root route
app.get("/", (_, res) => {
  res.send("Code Squeak API");
});

// All other routes require an API key
app.use("/api/v1", authMiddleware);
app.use("/api/v1/code-analysis", analysisRouter);

// And if there are problems handle them here
app.use(notFound);
app.use(errorHandler);

ViteExpress.listen(app, config.server.port, () =>
  logger.info({
    message: `Server is listening on port ${config.server.port}...`,
  })
);
