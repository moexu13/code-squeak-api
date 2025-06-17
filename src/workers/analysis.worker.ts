import { redisClient } from "../utils/redis";
import { AnalysisQueue } from "../api/analysis/analysis.queue";
import logger from "../utils/logger";
import { DEFAULT_QUEUE_CONFIG } from "../api/analysis/types/queue";

export class AnalysisWorker {
  private isProcessing: boolean = false;
  private queue: AnalysisQueue;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private processingPromise: Promise<void> | null = null;

  constructor() {
    this.queue = AnalysisQueue.getInstance({
      ...DEFAULT_QUEUE_CONFIG,
      workerCount: parseInt(process.env.WORKER_COUNT || "1", 10),
      pollInterval: parseInt(process.env.POLL_INTERVAL || "100", 10),
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "21600000", 10),
      maxJobAge: parseInt(process.env.MAX_JOB_AGE || "604800000", 10),
    });
  }

  public async startWorker(): Promise<void> {
    try {
      // Connect to Redis
      await redisClient.connect();
      logger.info({ message: "Connected to Redis" });

      // Initialize queue
      await this.queue.initialize();
      logger.info({ message: "Analysis queue initialized" });

      // Start processing jobs
      this.isProcessing = true;
      logger.info({ message: "Worker started" });

      // Start job processing in the background
      this.processingPromise = this.queue.processJobs().catch((error) => {
        logger.error({
          message: "Error in job processing",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        this.isProcessing = false;
      });

      // Start cleanup interval (default: every 6 hours)
      const cleanupInterval = parseInt(
        process.env.CLEANUP_INTERVAL || "21600000",
        10
      );
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.queue.cleanupOldJobs();
        } catch (error) {
          logger.error({
            message: "Error in cleanup job",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }, cleanupInterval);

      // Start stats logging interval (default: every 5 minutes)
      const statsInterval = parseInt(
        process.env.STATS_INTERVAL || "300000",
        10
      );
      this.statsInterval = setInterval(async () => {
        try {
          const stats = await this.queue.getQueueStats();
          logger.info({
            message: "Queue stats",
            stats,
          });
        } catch (error) {
          logger.error({
            message: "Error getting queue stats",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }, statsInterval);

      // Handle graceful shutdown
      process.on("SIGTERM", async () => {
        logger.info({ message: "Received SIGTERM signal" });
        await this.stopWorker();
        setTimeout(() => process.exit(0), 0);
      });

      process.on("SIGINT", async () => {
        logger.info({ message: "Received SIGINT signal" });
        await this.stopWorker();
        setTimeout(() => process.exit(0), 0);
      });
    } catch (error) {
      logger.error({
        message: "Error starting worker",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.isProcessing = false;
      throw error;
    }
  }

  public async stopWorker(): Promise<void> {
    if (!this.isProcessing) return;

    logger.info({ message: "Stopping worker..." });
    this.isProcessing = false;

    try {
      // Stop the queue processing
      this.queue.stopProcessing();

      // Clear intervals
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      if (this.statsInterval) {
        clearInterval(this.statsInterval);
        this.statsInterval = null;
      }

      // Wait for processing to stop
      if (this.processingPromise) {
        try {
          await this.processingPromise;
        } catch (error) {
          // Ignore errors from stopped processing
        }
        this.processingPromise = null;
      }

      // Disconnect from Redis
      await redisClient.disconnect();
      logger.info({ message: "Worker stopped" });
    } catch (error) {
      logger.error({
        message: "Error stopping worker",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new AnalysisWorker();
  worker.startWorker().catch((error) => {
    logger.error({
      message: "Worker failed to start",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  });
}
