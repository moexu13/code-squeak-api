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
  /** Retry configuration for failed jobs */
  retryConfig: RetryConfig;
}

/**
 * Configuration for job retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  baseDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Whether to use exponential backoff */
  useExponentialBackoff: boolean;
  /** List of error types that should trigger a retry */
  retryableErrors: string[];
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
  /** Number of jobs currently in retry state */
  retrying: number;
  /** Average number of retries per failed job */
  averageRetries: number;
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
  /** Number of retries attempted in the last interval */
  retriesAttempted: number;
  /** Number of successful retries in the last interval */
  retriesSucceeded: number;
}
