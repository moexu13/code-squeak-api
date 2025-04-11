import { Anthropic } from "@anthropic-ai/sdk";
import { Context } from "hono";

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
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }
      return content.text;
    } catch (error) {
      this.context.error("Claude API Error:", error);
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
      this.context.error("Claude API Error:", error);
      throw new Error(
        `Claude API Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
