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
import errorHandler from "./errors/errorHandler";

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", async () => {
  await redisClient.disconnect();
  process.exit(0);
});

export default app;
