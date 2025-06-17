import { redisClient } from "../utils/redis";
import { AnalysisQueue } from "../api/analysis/analysis.queue";

export class AnalysisWorker {
  private isProcessing: boolean = false;
  private queue: AnalysisQueue;

  constructor() {
    this.queue = AnalysisQueue.getInstance();
  }

  public async startWorker(): Promise<void> {
    try {
      // Connect to Redis
      await redisClient.connect();
      console.log("Connected to Redis");

      // Initialize queue
      await this.queue.initialize();
      console.log("Analysis queue initialized");

      // Start processing jobs
      this.isProcessing = true;
      console.log("Worker started");

      // Start job processing in the background
      process.nextTick(async () => {
        try {
          await this.queue.processJobs();
        } catch (error) {
          console.error(
            "Error in job processing:",
            error instanceof Error ? error.message : "Unknown error"
          );
          this.isProcessing = false;
        }
      });

      // Handle graceful shutdown
      process.on("SIGTERM", async () => {
        console.log("Received SIGTERM signal");
        await this.stopWorker();
        setTimeout(() => process.exit(0), 0);
      });

      process.on("SIGINT", async () => {
        console.log("Received SIGINT signal");
        await this.stopWorker();
        setTimeout(() => process.exit(0), 0);
      });
    } catch (error) {
      console.error(
        "Error starting worker:",
        error instanceof Error ? error.message : "Unknown error"
      );
      this.isProcessing = false;
      throw error;
    }
  }

  public async stopWorker(): Promise<void> {
    if (!this.isProcessing) return;

    console.log("Stopping worker...");
    this.isProcessing = false;

    try {
      await redisClient.disconnect();
      console.log("Worker stopped");
    } catch (error) {
      console.error(
        "Error stopping worker:",
        error instanceof Error ? error.message : "Unknown error"
      );
      throw error;
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new AnalysisWorker();
  worker.startWorker().catch((error) => {
    console.error("Worker failed to start:", error);
    process.exit(1);
  });
}
