/**
 * Configuration options for worker instances.
 */
export interface WorkerConfig {
  /** Number of worker processes to run */
  workerCount: number;
  /** How often to check for new jobs in milliseconds */
  pollInterval: number;
  /** How often to clean up old jobs in milliseconds */
  cleanupInterval: number;
  /** How long to keep jobs before cleanup in milliseconds */
  maxJobAge: number;
  /** How often to log stats in milliseconds */
  statsInterval: number;
}

/**
 * Statistics for the job queue.
 */
export interface QueueStats {
  /** Number of jobs waiting to be processed */
  pending: number;
  /** Number of jobs currently being processed */
  processing: number;
  /** Number of successfully completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Total number of jobs in the queue */
  total: number;
}

/**
 * Statistics for the worker process.
 */
export interface WorkerStats {
  /** Current queue statistics */
  queueStats: QueueStats;
  /** Worker uptime in seconds */
  uptime: number;
  /** Timestamp of last cleanup operation */
  lastCleanup: Date | null;
  /** Last error that occurred, if any */
  lastError: Error | null;
}
