import { AnalysisQueue } from "../api/analysis/analysis.queue";
import { BaseWorker } from "./base.worker";
import { WorkerStats } from "./types/worker";

/**
 * Worker implementation for processing pull request analysis jobs.
 * Extends the base worker to handle queue-specific operations.
 */
export class AnalysisWorker extends BaseWorker {
  private queue: AnalysisQueue;

  /**
   * Creates a new analysis worker instance.
   * Initializes the queue with configuration from environment variables.
   */
  constructor() {
    super();
    this.queue = AnalysisQueue.getInstance({
      workerCount: this.config.workerCount,
      pollInterval: this.config.pollInterval,
      cleanupInterval: this.config.cleanupInterval,
      maxJobAge: this.config.maxJobAge,
    });
  }

  /**
   * Initializes the worker by setting up the queue and starting job processing.
   * @throws {Error} If queue initialization fails
   */
  protected async initialize(): Promise<void> {
    await this.queue.initialize();
    this.processingPromise = this.queue.processJobs().catch((error) => {
      this.stats.lastError =
        error instanceof Error ? error : new Error(String(error));
      this.isProcessing = false;
    });
  }

  /**
   * Performs cleanup of old jobs in the queue.
   * @throws {Error} If cleanup fails
   */
  protected async cleanup(): Promise<void> {
    await this.queue.cleanupOldJobs();
  }

  /**
   * Retrieves current worker and queue statistics.
   * @returns {Promise<WorkerStats>} Current worker and queue statistics
   * @throws {Error} If stats retrieval fails
   */
  protected async getStats(): Promise<WorkerStats> {
    const queueStats = await this.queue.getQueueStats();
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
    this.queue.stopProcessing();
    await super.stop();
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
