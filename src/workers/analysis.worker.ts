import { redisClient } from "../utils/redis";
import { AnalysisQueue } from "../api/analysis/analysis.queue";
import logger from "../utils/logger";

async function startWorker() {
  try {
    // Connect to Redis
    await redisClient.connect();
    logger.info({ message: "Connected to Redis" });

    // Initialize and start the queue processor
    const queue = AnalysisQueue.getInstance();
    await queue.initialize();
    logger.info({ message: "Analysis queue initialized" });

    // Start processing jobs
    await queue.processJobs();
  } catch (error) {
    logger.error({
      message: "Worker failed to start",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info({ message: "Received SIGTERM signal, shutting down gracefully" });
  await redisClient.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info({ message: "Received SIGINT signal, shutting down gracefully" });
  await redisClient.disconnect();
  process.exit(0);
});

// Start the worker
startWorker().catch((error) => {
  logger.error({
    message: "Worker failed to start",
    error: error instanceof Error ? error.message : "Unknown error",
  });
  process.exit(1);
});
