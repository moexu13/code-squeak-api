export interface RedisConfig {
  url: string;
  retryStrategy: {
    maxDelay: number;
    initialDelay: number;
  };
  maxRetriesPerRequest: number;
}

export interface RedisError extends Error {
  code?: string;
  command?: string;
  args?: string[];
}
