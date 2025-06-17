import { redisClient } from "../../utils/redis";
import logger from "../../utils/logger";
import { PRAnalysisParams, analyzePullRequest } from "./analysis.service";

const STREAM_KEY = "pr-analysis:stream";
const CONSUMER_GROUP = "pr-analysis-group";
const CONSUMER_NAME = "pr-analysis-consumer";

interface QueueJob {
  id: string;
  data: PRAnalysisParams;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  createdAt: number;
  updatedAt: number;
}

export class AnalysisQueue {
  private static instance: AnalysisQueue;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): AnalysisQueue {
    if (!AnalysisQueue.instance) {
      AnalysisQueue.instance = new AnalysisQueue();
    }
    return AnalysisQueue.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const client = redisClient.getClient();
    try {
      // Create consumer group if it doesn't exist
      await client.xGroupCreate(STREAM_KEY, CONSUMER_GROUP, "0", {
        MKSTREAM: true,
      });
    } catch (error) {
      // Group might already exist, which is fine
      if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
        throw error;
      }
    }
    this.isInitialized = true;
  }

  public async addJob(params: PRAnalysisParams): Promise<string> {
    const client = redisClient.getClient();
    const job: QueueJob = {
      id: `${params.owner}/${params.repo}/${params.pull_number}`,
      data: params,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const id = await client.xAdd(STREAM_KEY, "*", {
      job: JSON.stringify(job),
    });

    logger.info({
      message: "Added PR analysis job to queue",
      jobId: id,
      params: {
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
      },
    });

    return id;
  }

  public async processJobs(): Promise<void> {
    const client = redisClient.getClient();

    while (true) {
      try {
        // Read pending jobs
        const response = await client.xReadGroup(
          CONSUMER_GROUP,
          CONSUMER_NAME,
          {
            key: STREAM_KEY,
            id: ">",
          },
          {
            COUNT: 1,
            BLOCK: 2000,
          }
        );

        if (!response || !Array.isArray(response) || response.length === 0)
          continue;

        const [[stream, messages]] = response;
        for (const [id, fields] of messages) {
          const job: QueueJob = JSON.parse(fields.job);

          try {
            // Update job status
            await this.updateJobStatus(id, "processing");

            // Process the job
            await analyzePullRequest(job.data);

            // Mark as completed
            await this.updateJobStatus(id, "completed");

            // Acknowledge the message
            await client.xAck(STREAM_KEY, CONSUMER_GROUP, id);
          } catch (error) {
            // Handle failure
            job.attempts++;
            if (job.attempts >= 3) {
              await this.updateJobStatus(id, "failed");
            } else {
              // Requeue the job
              await this.updateJobStatus(id, "pending");
              await client.xAck(STREAM_KEY, CONSUMER_GROUP, id);
              await this.addJob(job.data);
            }

            logger.error({
              message: "Failed to process PR analysis job",
              error: error instanceof Error ? error.message : "Unknown error",
              jobId: id,
              attempts: job.attempts,
            });
          }
        }
      } catch (error) {
        logger.error({
          message: "Error processing jobs",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async updateJobStatus(
    id: string,
    status: QueueJob["status"]
  ): Promise<void> {
    const client = redisClient.getClient();
    const job = await this.getJob(id);
    if (!job) return;

    job.status = status;
    job.updatedAt = Date.now();

    await client.xAdd(STREAM_KEY, id, {
      job: JSON.stringify(job),
    });
  }

  public async getJob(id: string): Promise<QueueJob | null> {
    const client = redisClient.getClient();
    const response = await client.xRange(STREAM_KEY, id, id);
    if (!Array.isArray(response) || response.length === 0) return null;

    return JSON.parse(response[0].message.job);
  }
}
