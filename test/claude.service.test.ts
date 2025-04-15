import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ClaudeService } from "../src/api/claude.service";
import { Anthropic } from "@anthropic-ai/sdk";
import { RateLimiter } from "../src/utils/rateLimiter";

// Mock the Anthropic client
vi.mock("@anthropic-ai/sdk", () => {
  return {
    Anthropic: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockImplementation(async ({ messages, stream }) => {
          if (stream) {
            return {
              async *[Symbol.asyncIterator]() {
                yield { type: "content_block_delta", delta: { text: "Mock" } };
                yield { type: "content_block_delta", delta: { text: " response" } };
              },
            };
          }
          return {
            content: [{ type: "text", text: "Mock response" }],
          };
        }),
      },
    })),
  };
});

// Mock the RateLimiter
vi.mock("../src/utils/rateLimiter", () => {
  return {
    RateLimiter: vi.fn().mockImplementation(() => ({
      waitForSlot: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("ClaudeService", () => {
  let claudeService: ClaudeService;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = {
      ...originalEnv,
      ANTHROPIC_API_KEY: "test-key",
      CLAUDE_MODEL: "test-model",
      CLAUDE_MAX_TOKENS: "500",
      CLAUDE_TEMPERATURE: "0.5",
    };
    claudeService = new ClaudeService();
  });

  afterEach(() => {
    // Restore environment after each test
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw error if ANTHROPIC_API_KEY is not set", () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new ClaudeService()).toThrow(
        "ANTHROPIC_API_KEY environment variable is required"
      );
    });

    it("should initialize with default values if environment variables are not set", () => {
      delete process.env.CLAUDE_MODEL;
      delete process.env.CLAUDE_MAX_TOKENS;
      delete process.env.CLAUDE_TEMPERATURE;
      const service = new ClaudeService();
      expect(service).toBeInstanceOf(ClaudeService);
    });
  });

  describe("sendMessage", () => {
    it("should send message with default options", async () => {
      const response = await claudeService.sendMessage("test prompt");
      expect(response).toBe("Mock response");
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: "test-key" });
      expect(RateLimiter).toHaveBeenCalledWith({
        maxRequests: 3,
        timeWindow: 60 * 1000,
      });
    });

    it("should use custom options when provided", async () => {
      const options = {
        model: "custom-model",
        maxTokens: 100,
        temperature: 0.8,
        systemPrompt: "custom system prompt",
      };
      await claudeService.sendMessage("test prompt", options);
      const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value;
      expect(anthropicInstance.messages.create).toHaveBeenCalledWith({
        model: "custom-model",
        max_tokens: 100,
        temperature: 0.8,
        system: "custom system prompt",
        messages: [{ role: "user", content: "test prompt" }],
      });
    });

    it("should handle non-text response type", async () => {
      const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value;
      anthropicInstance.messages.create.mockResolvedValueOnce({
        content: [{ type: "image", text: "invalid" }],
      });
      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow(
        "Unexpected response type from Claude"
      );
    });

    it("should handle API errors", async () => {
      const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value;
      anthropicInstance.messages.create.mockRejectedValueOnce(new Error("API Error"));
      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow(
        "Claude API Error: API Error"
      );
    });

    it("should respect rate limiting", async () => {
      const rateLimiterInstance = vi.mocked(RateLimiter).mock.results[0].value;
      await claudeService.sendMessage("test prompt");
      expect(rateLimiterInstance.waitForSlot).toHaveBeenCalled();
    });
  });

  describe("streamMessage", () => {
    it("should stream message with default options", async () => {
      const stream = await claudeService.streamMessage("test prompt");
      expect(stream).toBeInstanceOf(ReadableStream);

      const reader = stream.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: "content_block_delta", delta: { text: "Mock" } });
      expect(chunks[1]).toEqual({ type: "content_block_delta", delta: { text: " response" } });
    });

    it("should use custom options when streaming", async () => {
      const options = {
        model: "custom-model",
        maxTokens: 100,
        temperature: 0.8,
        systemPrompt: "custom system prompt",
      };
      await claudeService.streamMessage("test prompt", options);
      const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value;
      expect(anthropicInstance.messages.create).toHaveBeenCalledWith({
        model: "custom-model",
        max_tokens: 100,
        temperature: 0.8,
        system: "custom system prompt",
        messages: [{ role: "user", content: "test prompt" }],
        stream: true,
      });
    });

    it("should handle streaming errors", async () => {
      const anthropicInstance = vi.mocked(Anthropic).mock.results[0].value;
      anthropicInstance.messages.create.mockRejectedValueOnce(new Error("Streaming Error"));
      await expect(claudeService.streamMessage("test prompt")).rejects.toThrow(
        "Claude API Error: Streaming Error"
      );
    });

    it("should respect rate limiting when streaming", async () => {
      const rateLimiterInstance = vi.mocked(RateLimiter).mock.results[0].value;
      await claudeService.streamMessage("test prompt");
      expect(rateLimiterInstance.waitForSlot).toHaveBeenCalled();
    });
  });
});
