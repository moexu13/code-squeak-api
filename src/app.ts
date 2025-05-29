import express from "express";
import { init } from "@sentry/node";
import { config } from "./config/env";
import { redisClient } from "./utils/redis";

// Initialize Sentry first
init({
  dsn: config.sentry.dsn,
  environment: config.sentry.environment,
  tracesSampleRate: 1.0,
});

// Create Express app
const app = express();

// Initialize Redis
redisClient.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
  process.exit(1);
});

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

// Graceful shutdown
process.on("SIGTERM", async () => {
  await redisClient.disconnect();
  process.exit(0);
});

export default app;
