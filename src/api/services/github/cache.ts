import { RedisService } from "../redis/service";
import { GitHubConfig } from "./types";

export class GitHubCache {
  private redis: RedisService;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.redis = RedisService.getInstance();
    this.config = config;
  }

  getCacheKey(method: string, ...args: any[]): string {
    return `github:${method}:${args.join(":")}`;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.redis.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.redis.set(key, value, this.config.cacheTTL);
  }
}
