import { redisClient } from "../../utils/redis";
import logger from "../../utils/logger";
import { analyzePullRequest } from "./analysis.service";

export interface AnalysisJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  params: {
    owner: string;
    repo: string;
    pull_number: number;
  };
  result?: any;
  error?: string;
  created_at: number;
  updated_at: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export class AnalysisQueue {
  private static instance: AnalysisQueue;
  private readonly queueKey = "analysis:queue";
  private readonly jobsKey = "analysis:jobs";
  private isProcessing: boolean = false;
  private workerCount: number = 1;
  private workers: Set<Promise<void>> = new Set();

  private constructor() {}

  public static getInstance(): AnalysisQueue {
    if (!AnalysisQueue.instance) {
      AnalysisQueue.instance = new AnalysisQueue();
    }
    return AnalysisQueue.instance;
  }

  public async initialize(): Promise<void> {
    try {
      await redisClient.connect();
      logger.info({ message: "Redis Client Connected" });
    } catch (error) {
      logger.error({ message: "Failed to connect to Redis", error });
      throw error;
    }
  }

  public async addJob(params: AnalysisJob["params"]): Promise<AnalysisJob> {
    const job: AnalysisJob = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
      params,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    try {
      const client = redisClient.getClient();
      // Store job details
      await client.set(`${this.jobsKey}:${job.id}`, JSON.stringify(job));

      // Add job ID to queue
      await client.lPush(this.queueKey, job.id);

      logger.info({
        message: "Added PR analysis job to queue",
        jobId: job.id,
        params,
      });
      return job;
    } catch (error) {
      logger.error({ message: "Failed to add job to queue", error });
      throw error;
    }
  }

  public async getJob(jobId: string): Promise<AnalysisJob | null> {
    try {
      const client = redisClient.getClient();
      const jobData = await client.get(`${this.jobsKey}:${jobId}`);
      return jobData ? JSON.parse(jobData) : null;
    } catch (error) {
      logger.error({ message: "Failed to get job", error });
      return null;
    }
  }

  public async updateJobStatus(
    jobId: string,
    status: AnalysisJob["status"],
    result?: any,
    error?: string
  ): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const updatedJob: AnalysisJob = {
        ...job,
        status,
        result,
        error,
        updated_at: Date.now(),
      };

      const client = redisClient.getClient();
      await client.set(`${this.jobsKey}:${jobId}`, JSON.stringify(updatedJob));
      logger.info({ message: `Updated job ${jobId} status to ${status}` });
    } catch (error) {
      logger.error({ message: "Failed to update job status", error });
      throw error;
    }
  }

  public async processJobs(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    logger.info({ message: "Starting job processing" });

    // Start multiple workers based on workerCount
    for (let i = 0; i < this.workerCount; i++) {
      const worker = this.startWorker();
      this.workers.add(worker);
      worker.finally(() => this.workers.delete(worker));
    }

    // Wait for all workers to complete
    await Promise.all(this.workers);
  }

  private async startWorker(): Promise<void> {
    try {
      const client = redisClient.getClient();
      while (this.isProcessing) {
        // Get next job from queue
        const jobId = await client.rPop(this.queueKey);

        if (!jobId) {
          // No jobs in queue, wait a bit
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        logger.info({ message: `Processing job ${jobId}` });

        try {
          // Get job details
          const job = await this.getJob(jobId);
          if (!job) {
            logger.warn({ message: `Job ${jobId} not found` });
            continue;
          }

          // Update status to processing
          await this.updateJobStatus(jobId, "processing");

          // Process the job
          await this.processJob(job);

          // Update status to completed
          await this.updateJobStatus(jobId, "completed", { success: true });
          logger.info({ message: `Completed job ${jobId}` });
        } catch (error) {
          logger.error({
            message: `Error processing job ${jobId}`,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          await this.updateJobStatus(
            jobId,
            "failed",
            undefined,
            error instanceof Error ? error.message : "Unknown error"
          );
        }
      }
    } catch (error) {
      logger.error({
        message: "Error in job processing loop",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      this.isProcessing = false;
      throw error;
    }
  }

  private async processJob(job: AnalysisJob): Promise<void> {
    try {
      await analyzePullRequest(job.params);
      logger.info({
        message: `Processed job ${job.id}`,
        owner: job.params.owner,
        repo: job.params.repo,
        pull_number: job.params.pull_number,
      });
    } catch (error) {
      logger.error({
        message: `Error processing job ${job.id}`,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  public stopProcessing(): void {
    this.isProcessing = false;
  }

  public setWorkerCount(count: number): void {
    if (count < 1) {
      throw new Error("Worker count must be at least 1");
    }
    this.workerCount = count;
    logger.info({ message: `Worker count set to ${count}` });
  }

  public async getQueueStats(): Promise<QueueStats> {
    try {
      const client = redisClient.getClient();
      const jobs = await client.keys(`${this.jobsKey}:*`);
      const stats: QueueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: jobs.length,
      };

      for (const jobKey of jobs) {
        const job = await this.getJob(jobKey.split(":")[2]);
        if (job) {
          stats[job.status]++;
        }
      }

      return stats;
    } catch (error) {
      logger.error({
        message: "Failed to get queue stats",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  public async cleanupOldJobs(
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const jobs = await client.keys(`${this.jobsKey}:*`);
      let cleanedCount = 0;

      for (const jobKey of jobs) {
        const job = await this.getJob(jobKey.split(":")[2]);
        if (job && Date.now() - job.updated_at > maxAge) {
          await client.del(jobKey);
          cleanedCount++;
        }
      }

      logger.info({
        message: `Cleaned up ${cleanedCount} old jobs`,
        maxAge,
      });
    } catch (error) {
      logger.error({
        message: "Failed to clean up old jobs",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
