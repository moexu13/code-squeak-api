import logger from "./logger";

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenTimeout: number;
  successThreshold: number;
}

interface CircuitBreakerStats {
  failures: number;
  lastFailureTime: number;
  state: "closed" | "open" | "halfOpen";
  successes: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private stats: CircuitBreakerStats;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.stats = {
      failures: 0,
      lastFailureTime: 0,
      state: "closed",
      successes: 0,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.stats.state === "open") {
      if (Date.now() - this.stats.lastFailureTime >= this.config.resetTimeout) {
        this.stats.state = "halfOpen";
      } else {
        logger.error({
          message: "Circuit breaker is open",
          context: {
            failures: this.stats.failures,
            lastFailureTime: new Date(this.stats.lastFailureTime).toISOString(),
            resetTimeout: this.config.resetTimeout,
          },
        });
        throw new Error("Circuit breaker is open");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.stats.state === "halfOpen") {
      this.stats.successes++;
      if (this.stats.successes >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.stats.state === "closed") {
      this.stats.failures = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.stats.failures++;
    this.stats.lastFailureTime = Date.now();

    logger.error({
      message: "Circuit breaker failure",
      error: error instanceof Error ? error : new Error(String(error)),
      context: {
        failures: this.stats.failures,
        failureThreshold: this.config.failureThreshold,
        state: this.stats.state,
      },
    });

    if (this.stats.failures >= this.config.failureThreshold) {
      this.stats.state = "open";
      logger.error({
        message: "Circuit breaker opened",
        context: {
          failures: this.stats.failures,
          failureThreshold: this.config.failureThreshold,
          lastFailureTime: new Date(this.stats.lastFailureTime).toISOString(),
        },
      });
    }
  }

  private reset(): void {
    this.stats = {
      failures: 0,
      lastFailureTime: 0,
      state: "closed",
      successes: 0,
    };
    logger.info({
      message: "Circuit breaker reset",
      context: {
        previousState: this.stats.state,
      },
    });
  }
}
