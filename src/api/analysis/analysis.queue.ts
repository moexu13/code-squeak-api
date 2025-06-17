import { redisClient } from "../../utils/redis";
import logger from "../../utils/logger";
import { analyzePullRequest } from "./analysis.service";
import {
  AnalysisJob,
  QueueStats,
  QueueConfig,
  DEFAULT_QUEUE_CONFIG,
  PRAnalysisParams,
  JobResult,
} from "./types/queue";

export class AnalysisQueue {
  private static instance: AnalysisQueue;
  private readonly config: QueueConfig;
  private isProcessing: boolean = false;
  private workers: Set<Promise<void>> = new Set();

  private constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<QueueConfig>): AnalysisQueue {
    if (!AnalysisQueue.instance) {
      AnalysisQueue.instance = new AnalysisQueue(config);
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

  public async addJob(params: PRAnalysisParams): Promise<AnalysisJob> {
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
      await client.set(`${this.config.jobsKey}:${job.id}`, JSON.stringify(job));

      // Add job ID to queue
      await client.lPush(this.config.queueKey, job.id);

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
      const jobData = await client.get(`${this.config.jobsKey}:${jobId}`);
      return jobData ? JSON.parse(jobData) : null;
    } catch (error) {
      logger.error({ message: "Failed to get job", error });
      return null;
    }
  }

  public async updateJobStatus(
    jobId: string,
    status: AnalysisJob["status"],
    result?: JobResult,
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
      await client.set(
        `${this.config.jobsKey}:${jobId}`,
        JSON.stringify(updatedJob)
      );
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
    for (let i = 0; i < this.config.workerCount; i++) {
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
        const jobId = await client.rPop(this.config.queueKey);

        if (!jobId) {
          // No jobs in queue, wait a bit
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.pollInterval)
          );
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
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
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
        message: "Job processed successfully",
        jobId: job.id,
      });
    } catch (error) {
      logger.error({
        message: "Failed to analyze pull request",
        error: error instanceof Error ? error.message : "Unknown error",
        owner: job.params.owner,
        repo: job.params.repo,
        pull_number: job.params.pull_number,
      });
      throw error;
    }
  }

  public stopProcessing(): void {
    this.isProcessing = false;
  }

  public setWorkerCount(count: number): void {
    this.config.workerCount = count;
  }

  public async getQueueStats(): Promise<QueueStats> {
    try {
      const client = redisClient.getClient();
      const jobs = await client.keys(`${this.config.jobsKey}:*`);
      const stats: QueueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: jobs.length,
      };

      for (const jobKey of jobs) {
        const jobData = await client.get(jobKey);
        if (jobData) {
          const job: AnalysisJob = JSON.parse(jobData);
          stats[job.status]++;
        }
      }

      return stats;
    } catch (error) {
      logger.error({ message: "Failed to get queue stats", error });
      throw error;
    }
  }

  public async cleanupOldJobs(
    maxAge: number = this.config.maxJobAge
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const jobs = await client.keys(`${this.config.jobsKey}:*`);
      const now = Date.now();

      for (const jobKey of jobs) {
        const jobData = await client.get(jobKey);
        if (jobData) {
          const job: AnalysisJob = JSON.parse(jobData);
          if (now - job.updated_at > maxAge) {
            await client.del(jobKey);
            logger.info({ message: `Cleaned up old job ${job.id}` });
          }
        }
      }
    } catch (error) {
      logger.error({ message: "Failed to cleanup old jobs", error });
      throw error;
    }
  }
}
