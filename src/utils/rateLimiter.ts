import logger from "./logger";

interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly waitTimeMs: number,
    public readonly currentRequestCount: number,
    public readonly maxRequestLimit: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class RateLimiter {
  private requestTimestamps: number[] = [];
  private rateLimitConfig: RateLimitConfig;
  private lastErrorTimestamp: number | null = null;
  private consecutiveErrorCount: number = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = 5;
  private readonly ERROR_RESET_WINDOW_MS = 60 * 1000; // 1 minute

  constructor(config: RateLimitConfig) {
    this.rateLimitConfig = config;
  }

  private resetErrorCountIfNeeded(): void {
    const currentTimestamp = Date.now();
    if (
      this.lastErrorTimestamp &&
      currentTimestamp - this.lastErrorTimestamp > this.ERROR_RESET_WINDOW_MS
    ) {
      this.consecutiveErrorCount = 0;
      this.lastErrorTimestamp = null;
    }
  }

  private handleRateLimitError(): void {
    const currentTimestamp = Date.now();
    this.consecutiveErrorCount++;
    this.lastErrorTimestamp = currentTimestamp;

    if (this.consecutiveErrorCount >= this.MAX_CONSECUTIVE_ERRORS) {
      logger.warn(
        {
          errorCount: this.consecutiveErrorCount,
          context: "RateLimiter",
        },
        "Too many errors, resetting rate limiter"
      );
      this.requestTimestamps = [];
      this.consecutiveErrorCount = 0;
    }
  }

  async waitForSlot(): Promise<void> {
    const currentTimestamp = Date.now();
    this.resetErrorCountIfNeeded();

    // Remove old requests outside the time window
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => currentTimestamp - timestamp < this.rateLimitConfig.timeWindow
    );

    // If we've hit the limit, wait
    if (this.requestTimestamps.length >= this.rateLimitConfig.maxRequests) {
      const oldestRequestTimestamp = this.requestTimestamps[0];
      const waitTimeMs =
        this.rateLimitConfig.timeWindow - (currentTimestamp - oldestRequestTimestamp);

      logger.debug(
        {
          currentRequestCount: this.requestTimestamps.length,
          maxRequestLimit: this.rateLimitConfig.maxRequests,
          waitTimeMs,
          context: "RateLimiter",
        },
        "Rate limit reached, waiting"
      );

      this.handleRateLimitError();

      // Throw a specific error with details
      throw new RateLimitError(
        "Rate limit exceeded",
        waitTimeMs,
        this.requestTimestamps.length,
        this.rateLimitConfig.maxRequests
      );
    }

    // Add current request
    this.requestTimestamps.push(currentTimestamp);
  }
}
