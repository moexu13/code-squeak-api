import Anthropic from "@anthropic-ai/sdk";
import {
  ClaudeAuthenticationError,
  ClaudeTimeoutError,
  ClaudeRequestError,
} from "../../../utils/claudeErrors";
import { RateLimiter } from "../../../utils/rateLimiter";
import { CircuitBreaker } from "../../../utils/circuitBreaker";
import { getClaudeConfig } from "./config";
import { handleClaudeError } from "./error-handler";
import { ClaudeConfig, MessageOptions } from "./types";

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

    this.config = getClaudeConfig();
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
      return handleClaudeError(error, context, this.config.maxTokens);
    }
  }

  async sendMessage(message: string, options: MessageOptions = {}): Promise<string> {
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
    options: MessageOptions = {}
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

  getModel(): string {
    return this.config.model;
  }
}
