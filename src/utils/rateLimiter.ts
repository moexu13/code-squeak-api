import logger from "./logger";

interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

export class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the time window
    this.requests = this.requests.filter((time) => now - time < this.config.timeWindow);

    // If we've hit the limit, wait
    if (this.requests.length >= this.config.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.config.timeWindow - (now - oldestRequest);

      logger.debug(
        {
          currentRequests: this.requests.length,
          maxRequests: this.config.maxRequests,
          waitTime,
          context: "RateLimiter",
        },
        "Rate limit reached, waiting"
      );

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }

    // Add current request
    this.requests.push(now);
  }
}
