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

interface ClaudeConfig {
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export class ClaudeService {
  private client: Anthropic;
  private rateLimiter: RateLimiter;
  private config: ClaudeConfig;

  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      throw new ClaudeAuthenticationError("Claude API key not configured");
    }

    this.client = new Anthropic({
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
    };
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
    prompt: string,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<string> {
    const context = "sendMessage";
    logger.debug({ context }, "Sending message to Claude");

    if (prompt.length > this.config.maxTokens * 4) {
      throw new ClaudeTokenLimitError("Prompt exceeds maximum token limit", this.config.maxTokens);
    }

    const requestFn = async () => {
      const response = await this.client.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new ClaudeRequestError("Unexpected response type from Claude", 500);
      }
      return content.text;
    };

    return this.makeRequest(requestFn, context);
  }

  async streamMessage(
    prompt: string,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<AsyncIterable<string>> {
    const context = "streamMessage";
    logger.debug({ context }, "Streaming message from Claude");

    if (prompt.length > this.config.maxTokens * 4) {
      throw new ClaudeTokenLimitError("Prompt exceeds maximum token limit", this.config.maxTokens);
    }

    const requestFn = async () => {
      const response = await this.client.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      return response;
    };

    const stream = await this.makeRequest(requestFn, context);
    return this.processStream(stream);
  }

  private async *processStream(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>
  ): AsyncIterable<string> {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
