import Anthropic from "@anthropic-ai/sdk";
import logger from "../utils/logger";
import { RateLimiter } from "../utils/rateLimiter";
import {
  ClaudeError,
  ClaudeRateLimitError,
  ClaudeAuthenticationError,
  ClaudeRequestError,
  ClaudeTokenLimitError,
  ClaudeTimeoutError,
} from "../utils/claudeErrors";
import { CircuitBreaker } from "../utils/circuitBreaker";

interface ClaudeConfig {
  maxTokens: number;
  temperature: number;
  timeout: number;
  model: string;
}

export class ClaudeService {
  private anthropic: Anthropic;
  private rateLimiter: RateLimiter;
  private config: ClaudeConfig;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ClaudeAuthenticationError("Anthropic API key not configured");
    }

    this.anthropic = new Anthropic({
      apiKey,
    });

    this.rateLimiter = new RateLimiter({
      maxRequests: 3,
      timeWindow: 60 * 1000, // 1 minute
    });

    this.config = {
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || "1000"),
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || "0.7"),
      timeout: parseInt(process.env.CLAUDE_TIMEOUT || "30000"),
      model: process.env.CLAUDE_MODEL || "claude-3-opus-20240229",
    };

    this.circuitBreaker = new CircuitBreaker(3, 30000); // 3 failures, 30s reset
  }

  private async makeRequest<T>(requestFn: () => Promise<T>, context: string): Promise<T> {
    try {
      await this.rateLimiter.waitForSlot();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new ClaudeTimeoutError(`Request timed out after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });

      const response = await Promise.race([requestFn(), timeoutPromise]);
      return response;
    } catch (error) {
      if (error instanceof ClaudeError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes("rate limit")) {
          const retryAfter = this.extractRetryAfter(error.message);
          throw new ClaudeRateLimitError("Rate limit exceeded", retryAfter);
        }

        if (error.message.includes("authentication")) {
          throw new ClaudeAuthenticationError("Authentication failed");
        }

        if (error.message.includes("token limit")) {
          const maxTokens = this.extractMaxTokens(error.message);
          throw new ClaudeTokenLimitError("Token limit exceeded", maxTokens);
        }

        if (error.message.includes("timeout")) {
          throw new ClaudeTimeoutError("Request timed out");
        }
      }

      logger.error({ error, context }, "Unexpected error in Claude service");
      throw new ClaudeRequestError("Unexpected error occurred", 500);
    }
  }

  private extractRetryAfter(message: string): number | undefined {
    const match = message.match(/retry after (\d+) seconds/i);
    return match ? parseInt(match[1]) * 1000 : undefined;
  }

  private extractMaxTokens(message: string): number {
    const match = message.match(/max tokens: (\d+)/i);
    return match ? parseInt(match[1]) : this.config.maxTokens;
  }

  async sendMessage(
    message: string,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<string> {
    return this.circuitBreaker.execute(async () => {
      return this.makeRequest(async () => {
        const response = await this.anthropic.messages.create({
          model: this.config.model,
          max_tokens: options.maxTokens || this.config.maxTokens,
          temperature: options.temperature || this.config.temperature,
          messages: [{ role: "user", content: message }],
        });

        const content = response.content[0];
        if (content.type !== "text") {
          throw new ClaudeRequestError("Unexpected response type from Claude", 500);
        }
        return content.text;
      }, "sendMessage");
    });
  }

  async streamMessage(
    message: string,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<AsyncIterable<string>> {
    return this.circuitBreaker.execute(async () => {
      return this.makeRequest(async () => {
        const response = await this.anthropic.messages.create({
          model: this.config.model,
          max_tokens: options.maxTokens || this.config.maxTokens,
          temperature: options.temperature || this.config.temperature,
          messages: [{ role: "user", content: message }],
          stream: true,
        });

        return {
          [Symbol.asyncIterator]() {
            const iterator = response[Symbol.asyncIterator]();
            return {
              async next() {
                const { value, done } = await iterator.next();
                if (done) return { done: true, value: undefined };
                if (value.type === "content_block_delta" && value.delta.type === "text_delta") {
                  return { done: false, value: value.delta.text };
                }
                return { done: false, value: "" };
              },
            };
          },
        };
      }, "streamMessage");
    });
  }

  private handleClaudeError(error: unknown): never {
    if (error instanceof ClaudeError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        const retryAfter = this.extractRetryAfter(error.message);
        throw new ClaudeRateLimitError("Rate limit exceeded", retryAfter);
      }

      if (error.message.includes("authentication")) {
        throw new ClaudeAuthenticationError("Authentication failed");
      }

      if (error.message.includes("token limit")) {
        const maxTokens = this.extractMaxTokens(error.message);
        throw new ClaudeTokenLimitError("Token limit exceeded", maxTokens);
      }

      if (error.message.includes("timeout")) {
        throw new ClaudeTimeoutError("Request timed out");
      }
    }

    logger.error({ error }, "Unexpected error in Claude service");
    throw new ClaudeRequestError("Unexpected error occurred", 500);
  }

  getModel(): string {
    return this.config.model;
  }
}
