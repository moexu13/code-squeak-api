import { Anthropic } from "@anthropic-ai/sdk";
import { Context } from "hono";
import logger from "../utils/logger";

interface ClaudeOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export class ClaudeService {
  private client: Anthropic;
  private context: Context;

  constructor(context: Context) {
    this.context = context;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      logger.error(
        { context: "ClaudeService" },
        "ANTHROPIC_API_KEY environment variable is required"
      );
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  async sendMessage(prompt: string, options: ClaudeOptions = {}): Promise<string> {
    const {
      model = process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
      maxTokens = 1024,
      temperature = 0.7,
      systemPrompt,
    } = options;

    try {
      logger.debug(
        {
          model,
          maxTokens,
          temperature,
          hasSystemPrompt: !!systemPrompt,
          context: "ClaudeService",
        },
        "Sending message to Claude"
      );

      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        logger.error(
          {
            type: content.type,
            context: "ClaudeService",
          },
          "Unexpected response type from Claude"
        );
        throw new Error("Unexpected response type from Claude");
      }

      logger.debug(
        {
          responseLength: content.text.length,
          context: "ClaudeService",
        },
        "Received response from Claude"
      );

      return content.text;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          model,
          context: "ClaudeService",
        },
        "Failed to send message to Claude"
      );
      throw new Error(
        `Claude API Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async streamMessage(prompt: string, options: ClaudeOptions = {}): Promise<ReadableStream> {
    const {
      model = process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
      maxTokens = 1024,
      temperature = 0.7,
      systemPrompt,
    } = options;

    try {
      logger.debug(
        {
          model,
          maxTokens,
          temperature,
          hasSystemPrompt: !!systemPrompt,
          context: "ClaudeService",
        },
        "Starting Claude stream"
      );

      const stream = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      return new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          model,
          context: "ClaudeService",
        },
        "Failed to start Claude stream"
      );
      throw new Error(
        `Claude API Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
