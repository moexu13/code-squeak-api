export interface WorkerConfig {
  workerCount: number;
  pollInterval: number;
  cleanupInterval: number;
  maxJobAge: number;
  statsInterval: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface WorkerStats {
  queueStats: QueueStats;
  uptime: number;
  lastCleanup: Date | null;
  lastError: Error | null;
}
