import { GitHubConfig } from "./types";

export const getGitHubConfig = (): GitHubConfig => ({
  cacheTTL: 5 * 60, // 5 minutes in seconds
  circuitBreakerFailures: 3,
  circuitBreakerResetTime: 30000, // 30 seconds
});
