import express from "express";
import { init } from "@sentry/node";
import { config } from "./config/env";
import { redisClient } from "./utils/redis";
import logger from "./utils/logger";
import { sanitizeErrorMessage } from "./utils/sanitize";

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
  logger.error({
    message: "Failed to connect to Redis",
    error: sanitizeErrorMessage(
      err instanceof Error ? err.message : String(err)
    ),
  });
  process.exit(1);
});

// Middleware
// Limit JSON payload size to prevent memory attacks
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Import routes
import errorHandler from "./errors/errorHandler";

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", async () => {
  await redisClient.disconnect();
  process.exit(0);
});

export default app;
