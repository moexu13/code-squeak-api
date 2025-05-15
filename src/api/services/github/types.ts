export interface PullRequest {
  title: string;
  body: string | null;
  user: string;
  state: string;
  url: string;
  diff: string;
}

export interface GitHubConfig {
  cacheTTL: number;
  circuitBreakerFailures: number;
  circuitBreakerResetTime: number;
}

export interface GitHubResponse<T> {
  data: T;
  headers?: {
    [key: string]: string;
  };
}
