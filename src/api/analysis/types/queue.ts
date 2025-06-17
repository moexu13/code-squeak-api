/**
 * Queue configuration types for the analysis queue system
 */

/**
 * Status of a job in the queue
 */
export type JobStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Base parameters for a PR analysis job
 */
export interface PRAnalysisParams {
  owner: string;
  repo: string;
  pull_number: number;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

/**
 * Result of a completed job
 */
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * A job in the analysis queue
 */
export interface AnalysisJob {
  id: string;
  status: JobStatus;
  params: PRAnalysisParams;
  result?: JobResult;
  error?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Statistics about the queue
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Configuration for the queue system
 */
export interface QueueConfig {
  queueKey: string;
  jobsKey: string;
  workerCount: number;
  pollInterval: number;
  cleanupInterval: number;
  maxJobAge: number;
}

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  queueKey: "analysis:queue",
  jobsKey: "analysis:jobs",
  workerCount: 1,
  pollInterval: 100, // milliseconds
  cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  maxJobAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

/**
 * Events that can be emitted by the queue
 */
export type QueueEvent =
  | { type: "job.added"; job: AnalysisJob }
  | { type: "job.started"; jobId: string }
  | { type: "job.completed"; job: AnalysisJob }
  | { type: "job.failed"; jobId: string; error: string }
  | { type: "queue.stats"; stats: QueueStats };

/**
 * Options for adding a job to the queue
 */
export interface AddJobOptions {
  priority?: number;
  timeout?: number;
  retries?: number;
}

/**
 * Options for processing a job
 */
export interface ProcessJobOptions {
  timeout?: number;
  retries?: number;
  backoff?: {
    type: "fixed" | "exponential";
    delay: number;
  };
}
