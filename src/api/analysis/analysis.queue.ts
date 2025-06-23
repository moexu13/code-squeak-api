import { redisClient } from "../../utils/redis";
import logger from "../../utils/logger";
import { sanitizeErrorMessage } from "../../utils/sanitize";
import {
  AnalysisJob,
  QueueStats,
  QueueConfig,
  DEFAULT_QUEUE_CONFIG,
  PRAnalysisParams,
  JobResult,
} from "./types/queue";

export class AnalysisQueue {
  private static instance: AnalysisQueue | null = null;
  private static initializationPromise: Promise<AnalysisQueue> | null = null;
  private readonly config: QueueConfig;
  private isProcessing: boolean = false;

  private constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  public static getInstance(config?: Partial<QueueConfig>): AnalysisQueue {
    if (!AnalysisQueue.instance) {
      AnalysisQueue.instance = new AnalysisQueue(config);
    }
    return AnalysisQueue.instance;
  }

  public static async getInstanceAsync(
    config?: Partial<QueueConfig>
  ): Promise<AnalysisQueue> {
    if (!AnalysisQueue.instance) {
      if (!AnalysisQueue.initializationPromise) {
        AnalysisQueue.initializationPromise = (async () => {
          const instance = new AnalysisQueue(config);
          await instance.start();
          return instance;
        })();
      }
      AnalysisQueue.instance = await AnalysisQueue.initializationPromise;
    }
    return AnalysisQueue.instance;
  }

  public async start(): Promise<void> {
    try {
      await redisClient.connect();
      this.isProcessing = true;
      logger.info({ message: "Redis Client Connected" });
    } catch (error) {
      logger.error({
        message: "Failed to connect to Redis",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
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
      retryCount: 0,
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
      logger.error({
        message: "Failed to add job to queue",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
      throw error;
    }
  }

  public async getJob(jobId: string): Promise<AnalysisJob | null> {
    try {
      const client = redisClient.getClient();
      const jobData = await client.get(`${this.config.jobsKey}:${jobId}`);
      return jobData ? JSON.parse(jobData) : null;
    } catch (error) {
      logger.error({
        message: "Failed to get job",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
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
      logger.error({
        message: "Failed to update job status",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
      throw error;
    }
  }

  public async getNextJob(): Promise<AnalysisJob | null> {
    try {
      if (!this.isProcessing) {
        return null;
      }

      const client = redisClient.getClient();
      const jobId = await client.rPop(this.config.queueKey);
      if (!jobId) {
        return null;
      }

      const job = await this.getJob(jobId);
      if (!job) {
        logger.warn({ message: `Job ${jobId} not found` });
        return null;
      }

      await this.updateJobStatus(jobId, "processing");
      return job;
    } catch (error) {
      logger.error({
        message: "Failed to get next job",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
      return null;
    }
  }

  public async completeJob(jobId: string, result: JobResult): Promise<void> {
    await this.updateJobStatus(jobId, "completed", result);
  }

  public async failJob(jobId: string, error: Error): Promise<void> {
    const sanitizedErrorMessage = sanitizeErrorMessage(error.message);
    await this.updateJobStatus(
      jobId,
      "failed",
      { success: false, error: sanitizedErrorMessage },
      sanitizedErrorMessage
    );
  }

  public async retryJob(jobId: string, delay: number): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const nextRetryCount = (job.retryCount || 0) + 1;
      const updatedJob: AnalysisJob = {
        ...job,
        status: nextRetryCount > 3 ? "failed" : "retrying",
        retryCount: nextRetryCount,
        updated_at: Date.now(),
      };

      const client = redisClient.getClient();
      await client.set(
        `${this.config.jobsKey}:${jobId}`,
        JSON.stringify(updatedJob)
      );

      // Only add back to queue if not failed
      if (updatedJob.status === "retrying") {
        // Add job back to queue after delay
        await new Promise((resolve) => setTimeout(resolve, delay));
        try {
          await client.lPush(this.config.queueKey, jobId);
          logger.info({
            message: "Retried job added back to queue",
            jobId,
            retryCount: updatedJob.retryCount,
          });
        } catch (error) {
          logger.error({
            message: "Failed to add retried job back to queue",
            jobId,
            error: sanitizeErrorMessage(
              error instanceof Error ? error.message : String(error)
            ),
          });
          throw error;
        }

        logger.info({
          message: "Job scheduled for retry",
          jobId,
          retryCount: updatedJob.retryCount,
          delay,
        });
      } else {
        logger.info({
          message: "Job failed after max retries",
          jobId,
          retryCount: updatedJob.retryCount,
        });
      }
    } catch (error) {
      logger.error({
        message: "Failed to retry job",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
      throw error;
    }
  }

  public stopProcessing(): void {
    this.isProcessing = false;
  }

  public async getStats(): Promise<QueueStats> {
    try {
      const client = redisClient.getClient();
      const jobs = await client.keys(`${this.config.jobsKey}:*`);
      const stats: QueueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retrying: 0,
        total: jobs.length,
        averageRetries: 0,
      };

      let totalRetries = 0;
      for (const jobKey of jobs) {
        const jobData = await client.get(jobKey);
        if (jobData) {
          const job: AnalysisJob = JSON.parse(jobData);
          stats[job.status]++;
          if (job.retryCount) {
            totalRetries += job.retryCount;
          }
        }
      }

      stats.averageRetries = stats.total > 0 ? totalRetries / stats.total : 0;
      return stats;
    } catch (error) {
      logger.error({
        message: "Failed to get queue stats",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      const client = redisClient.getClient();
      const jobs = await client.keys(`${this.config.jobsKey}:*`);
      const now = Date.now();

      for (const jobKey of jobs) {
        const jobData = await client.get(jobKey);
        if (jobData) {
          const job: AnalysisJob = JSON.parse(jobData);
          if (now - job.updated_at > this.config.maxJobAge) {
            await client.del(jobKey);
            logger.info({
              message: "Cleaned up old job",
              jobId: job.id,
              age: now - job.updated_at,
            });
          }
        }
      }
    } catch (error) {
      logger.error({
        message: "Failed to cleanup old jobs",
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : String(error)
        ),
      });
      throw error;
    }
  }
}
