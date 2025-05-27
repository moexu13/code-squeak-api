import express from "express";
import { init } from "@sentry/node";
import { config } from "./config/env";

// Initialize Sentry first
init({
  dsn: config.sentry.dsn,
  environment: config.sentry.environment,
  tracesSampleRate: 1.0,
});

// Create Express app
const app = express();

// Middleware
app.use(express.json());

// Import routes
import analysisRouter from "./api/analysis/analysis.router";
import githubRouter from "./api/github/github.routes";
import errorHandler from "./errors/errorHandler";
import { NotFoundError } from "./errors/http";
import authMiddleware from "./middleware/auth";

// Apply middleware
app.use(authMiddleware);

// Mount routes
app.use("/api/v1/code-analysis", analysisRouter);
app.use("/api/v1/github", githubRouter);

// Error handling
app.use((req, _res, next) => {
  next(new NotFoundError(`Not found: ${req.originalUrl}`));
});
app.use(errorHandler);

export default app;
