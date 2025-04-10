import { describe, it, expect, beforeAll } from "vitest";
import { ClaudeService } from "../src/api/claude.service";
import { config } from "dotenv";

describe("ClaudeService", () => {
  let claudeService: ClaudeService;

  beforeAll(() => {
    // Load environment variables
    config();

    // Verify required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required for tests");
    }

    claudeService = new ClaudeService();
  });

  it("should be able to send a message to Claude", async () => {
    const prompt = "What is 2+2?";
    const response = await claudeService.sendMessage(prompt, {
      maxTokens: 100,
      temperature: 0.1, // Low temperature for more deterministic responses
    });

    expect(response).toBeDefined();
    expect(typeof response).toBe("string");
    expect(response.length).toBeGreaterThan(0);
    expect(response.toLowerCase()).toContain("4");
  });

  it("should handle streaming responses", async () => {
    const prompt = "Count from 1 to 3";
    const stream = await claudeService.streamMessage(prompt, {
      maxTokens: 100,
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

    // Check for numbers in the response
    const numbers = response.match(/\d+/g);
    expect(numbers).toBeDefined();
    expect(numbers?.length).toBeGreaterThan(0);
  });

  it("should handle errors gracefully", async () => {
    const invalidPrompt = "";
    await expect(claudeService.sendMessage(invalidPrompt)).rejects.toThrow();
  });
});
