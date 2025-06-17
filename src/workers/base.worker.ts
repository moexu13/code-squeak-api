import { redisClient } from "../utils/redis";
import logger from "../utils/logger";
import { WorkerConfig, WorkerStats } from "./types/worker";

export abstract class BaseWorker {
  protected isProcessing: boolean = false;
  protected cleanupInterval: NodeJS.Timeout | null = null;
  protected statsInterval: NodeJS.Timeout | null = null;
  protected processingPromise: Promise<void> | null = null;
  protected config: WorkerConfig;
  protected stats: WorkerStats;

  /**
   * Creates a new worker instance with the specified configuration.
   * @param config - Optional configuration to override default settings
   */
  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = {
      workerCount: parseInt(process.env.WORKER_COUNT || "1", 10),
      pollInterval: parseInt(process.env.POLL_INTERVAL || "100", 10),
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || "21600000", 10),
      maxJobAge: parseInt(process.env.MAX_JOB_AGE || "604800000", 10),
      statsInterval: parseInt(process.env.STATS_INTERVAL || "300000", 10),
      ...config,
    };

    this.stats = {
      queueStats: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      },
      uptime: 0,
      lastCleanup: null,
      lastError: null,
    };
  }

  protected abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract getStats(): Promise<WorkerStats>;

  /**
   * Starts the worker process.
   * This will:
   * 1. Connect to Redis
   * 2. Initialize the worker
   * 3. Start processing jobs
   * 4. Set up cleanup and stats intervals
   * 5. Register shutdown handlers
   *
   * @throws {Error} If there's an error during startup
   */
  public async start(): Promise<void> {
    try {
      await redisClient.connect();
      logger.info({ message: "Connected to Redis" });

      await this.initialize();
      logger.info({ message: "Worker initialized" });

      this.isProcessing = true;
      logger.info({ message: "Worker started" });

      // Start cleanup interval
      this.cleanupInterval = setInterval(async () => {
        try {
          await this.cleanup();
          this.stats.lastCleanup = new Date();
        } catch (error) {
          this.stats.lastError =
            error instanceof Error ? error : new Error(String(error));
          logger.error({
            message: "Error in cleanup job",
            error: this.stats.lastError.message,
          });
        }
      }, this.config.cleanupInterval);

      // Start stats logging interval
      this.statsInterval = setInterval(async () => {
        try {
          this.stats = await this.getStats();
          logger.info({
            message: "Worker stats",
            stats: this.stats,
          });
        } catch (error) {
          this.stats.lastError =
            error instanceof Error ? error : new Error(String(error));
          logger.error({
            message: "Error getting worker stats",
            error: this.stats.lastError.message,
          });
        }
      }, this.config.statsInterval);

      // Handle graceful shutdown
      process.on("SIGTERM", this.handleShutdown.bind(this));
      process.on("SIGINT", this.handleShutdown.bind(this));
    } catch (error) {
      logger.error({
        message: "Error starting worker",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.isProcessing = false;
      throw error;
    }
  }

  /**
   * Stops the worker process gracefully.
   * This will:
   * 1. Stop processing new jobs
   * 2. Clear all intervals
   * 3. Wait for current processing to complete
   * 4. Disconnect from Redis
   *
   * @throws {Error} If there's an error during shutdown
   */
  public async stop(): Promise<void> {
    if (!this.isProcessing) return;

    logger.info({ message: "Stopping worker..." });
    this.isProcessing = false;

    try {
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

  private async handleShutdown(): Promise<void> {
    logger.info({ message: "Received shutdown signal" });
    await this.stop();
    setTimeout(() => process.exit(0), 0);
  }
}
