import { AnalysisQueue } from "../api/analysis/analysis.queue";
import { BaseWorker } from "./base.worker";
import { WorkerStats } from "./types/worker";

export class AnalysisWorker extends BaseWorker {
  private queue: AnalysisQueue;

  constructor() {
    super();
    this.queue = AnalysisQueue.getInstance({
      workerCount: this.config.workerCount,
      pollInterval: this.config.pollInterval,
      cleanupInterval: this.config.cleanupInterval,
      maxJobAge: this.config.maxJobAge,
    });
  }

  protected async initialize(): Promise<void> {
    await this.queue.initialize();
    this.processingPromise = this.queue.processJobs().catch((error) => {
      this.stats.lastError =
        error instanceof Error ? error : new Error(String(error));
      this.isProcessing = false;
    });
  }

  protected async cleanup(): Promise<void> {
    await this.queue.cleanupOldJobs();
  }

  protected async getStats(): Promise<WorkerStats> {
    const queueStats = await this.queue.getQueueStats();
    return {
      ...this.stats,
      queueStats,
      uptime: process.uptime(),
    };
  }

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
