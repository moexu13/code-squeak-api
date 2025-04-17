import logger from "./logger";

interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly waitTime: number,
    public readonly currentRequests: number,
    public readonly maxRequests: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;
  private lastErrorTime: number | null = null;
  private errorCount: number = 0;
  private readonly MAX_ERRORS_BEFORE_RESET = 5;
  private readonly ERROR_WINDOW = 60 * 1000; // 1 minute

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  private resetIfNeeded(): void {
    const now = Date.now();
    if (this.lastErrorTime && now - this.lastErrorTime > this.ERROR_WINDOW) {
      this.errorCount = 0;
      this.lastErrorTime = null;
    }
  }

  private handleError(): void {
    const now = Date.now();
    this.errorCount++;
    this.lastErrorTime = now;

    if (this.errorCount >= this.MAX_ERRORS_BEFORE_RESET) {
      logger.warn(
        {
          errorCount: this.errorCount,
          context: "RateLimiter",
        },
        "Too many errors, resetting rate limiter"
      );
      this.requests = [];
      this.errorCount = 0;
    }
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.resetIfNeeded();

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

      // Throw a specific error with details
      throw new RateLimitError(
        "Rate limit exceeded",
        waitTime,
        this.requests.length,
        this.config.maxRequests
      );
    }

    // Add current request
    this.requests.push(now);
  }
}
