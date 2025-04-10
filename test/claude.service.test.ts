import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ClaudeService } from "../src/api/claude.service";
import { config } from "dotenv";
import { Context } from "hono";

describe("ClaudeService", () => {
  let claudeService: ClaudeService;
  const mockContext = {
    error: console.error,
    log: console.log,
  } as unknown as Context;

  beforeAll(() => {
    // Load environment variables
    config();

    // Verify required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required for tests");
    }

    claudeService = new ClaudeService(mockContext);
  });

  it(
    "should be able to send a message to Claude",
    async () => {
      const prompt = "Say hello";
      const response = await claudeService.sendMessage(prompt, {
        maxTokens: 10,
        temperature: 0.1,
      });

      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
      expect(response.length).toBeGreaterThan(0);
    },
    { timeout: 10000 }
  );

  it(
    "should handle streaming responses",
    async () => {
      const prompt = "Say hello";
      const stream = await claudeService.streamMessage(prompt, {
        maxTokens: 10,
        temperature: 0.1,
      });

      expect(stream).toBeInstanceOf(ReadableStream);

      // Read the stream
      const reader = stream.getReader();
      let response = "";
      let done = false;

      while (!done) {
        const { value, done: isDone } = await reader.read();
        done = isDone;
        if (value) {
          // Handle the streaming response format
          if (value.type === "content_block_delta" && value.delta?.text) {
            response += value.delta.text;
          }
        }
      }

      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
      expect(response.length).toBeGreaterThan(0);
    },
    { timeout: 10000 }
  );

  it(
    "should handle errors gracefully",
    async () => {
      const invalidPrompt = "";
      await expect(claudeService.sendMessage(invalidPrompt)).rejects.toThrow();
    },
    { timeout: 5000 }
  );
});
