import { AnalysisQueue } from "../api/analysis/analysis.queue";
import { BaseWorker } from "./base.worker";
import { analyzePullRequest } from "../api/analysis/analysis.service";
import logger from "../utils/logger";
import { sanitizeErrorMessage } from "../utils/sanitize";
import { WorkerStats } from "./types/worker";

/**
 * Worker implementation for processing pull request analysis jobs.
 * Extends the base worker to handle queue-specific operations.
 */
export class AnalysisWorker extends BaseWorker {
  private queue: AnalysisQueue | null = null;

  /**
   * Creates a new analysis worker instance.
   * Initializes the queue with configuration from environment variables.
   */
  constructor() {
    super();
  }

  /**
   * Initializes the worker by setting up the queue and starting job processing.
   * @throws {Error} If queue initialization fails
   */
  protected async initialize(): Promise<void> {
    this.queue = await AnalysisQueue.getInstanceAsync({
      workerCount: this.config.workerCount,
      pollInterval: this.config.pollInterval,
      cleanupInterval: this.config.cleanupInterval,
      maxJobAge: this.config.maxJobAge,
      retryConfig: this.config.retryConfig,
    });
  }

  /**
   * Performs cleanup of old jobs in the queue.
   * @throws {Error} If cleanup fails
   */
  protected async cleanup(): Promise<void> {
    if (!this.queue) {
      throw new Error("Queue not initialized");
    }
    await this.queue.cleanup();
  }

  /**
   * Retrieves current worker and queue statistics.
   * @returns {Promise<WorkerStats>} Current worker and queue statistics
   * @throws {Error} If stats retrieval fails
   */
  protected async getStats(): Promise<WorkerStats> {
    if (!this.queue) {
      throw new Error("Queue not initialized");
    }
    const queueStats = await this.queue.getStats();
    return {
      ...this.stats,
      queueStats,
      uptime: process.uptime(),
    };
  }

  /**
   * Stops the worker and queue processing.
   * This will:
   * 1. Stop the queue from processing new jobs
   * 2. Stop the worker and clean up resources
   *
   * @throws {Error} If stopping fails
   */
  public async stop(): Promise<void> {
    if (this.queue) {
      // Set the queue to not processing mode
      this.queue["isProcessing"] = false;
      await this.queue.stopProcessing();
    }
    await super.stop();
  }

  protected async startProcessing(): Promise<void> {
    if (!this.queue) {
      throw new Error("Queue not initialized");
    }

    // Set the queue to processing mode
    this.queue["isProcessing"] = true;

    this.processingPromise = (async () => {
      while (this.isProcessing) {
        try {
          const job = await this.queue!.getNextJob();
          if (!job) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.config.pollInterval)
            );
            continue;
          }

          try {
            logger.info({
              message: "Processing analysis job",
              jobId: job.id,
              params: job.params,
            });

            await analyzePullRequest(job.params);
            await this.queue!.completeJob(job.id, { success: true });

            logger.info({
              message: "Analysis job completed",
              jobId: job.id,
            });
          } catch (error) {
            const shouldRetry = this.shouldRetry(error as Error);
            const retryCount = job.retryCount || 0;

            if (shouldRetry && retryCount < 3) {
              const delay = this.calculateRetryDelay(retryCount + 1);
              logger.info({
                message: "Retrying analysis job",
                jobId: job.id,
                retryCount: retryCount + 1,
                delay,
                error: sanitizeErrorMessage(
                  error instanceof Error ? error.message : "Unknown error"
                ),
              });

              this.stats.retriesAttempted++;
              await this.queue!.retryJob(job.id, delay);
            } else {
              logger.error({
                message: "Analysis job failed",
                jobId: job.id,
                error: sanitizeErrorMessage(
                  error instanceof Error ? error.message : "Unknown error"
                ),
                retryCount,
                maxRetries: this.config.retryConfig.maxRetries,
              });

              await this.queue!.failJob(
                job.id,
                error instanceof Error ? error : new Error(String(error))
              );
            }
          }
        } catch (error) {
          logger.error({
            message: "Error processing job",
            error: sanitizeErrorMessage(
              error instanceof Error ? error.message : "Unknown error"
            ),
          });
          this.stats.lastError =
            error instanceof Error ? error : new Error(String(error));
        }
      }
    })();
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new AnalysisWorker();
  worker.start().catch((error) => {
    console.error("Worker failed to start:", error);
    process.exit(1);
  });
}
