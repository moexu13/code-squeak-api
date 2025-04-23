import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ClaudeService } from "../src/api/claude.service";
import { RateLimiter } from "../src/utils/rateLimiter";

// Mock the Anthropic client
const mockClient = {
  messages: {
    create: vi.fn().mockImplementation(async ({ messages, stream }) => {
      if (stream) {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: "content_block_delta", delta: { type: "text_delta", text: "Mock" } };
            yield { type: "content_block_delta", delta: { type: "text_delta", text: " response" } };
          },
        };
      }
      return {
        content: [{ type: "text", text: "Mock response" }],
      };
    }),
  },
};

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => mockClient),
  Anthropic: vi.fn().mockImplementation(() => mockClient),
}));

// Mock the RateLimiter
vi.mock("../src/utils/rateLimiter", () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    waitForSlot: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("ClaudeService", () => {
  let claudeService: ClaudeService;
  const originalEnv = process.env;

  beforeEach(() => {
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
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw error if ANTHROPIC_API_KEY is not set", () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new ClaudeService()).toThrow("Anthropic API key not configured");
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
    });

    it("should use custom options when provided", async () => {
      const options = {
        maxTokens: 100,
        temperature: 0.8,
      };
      await claudeService.sendMessage("test prompt", options);
      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: claudeService.getModel(),
        max_tokens: 100,
        temperature: 0.8,
        messages: [{ role: "user", content: "test prompt" }],
      });
    });

    it("should handle non-text response type", async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        content: [{ type: "image", text: "invalid" }],
      });
      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow(
        "Unexpected response type from Claude"
      );
    });

    it("should handle API errors", async () => {
      mockClient.messages.create.mockRejectedValueOnce(new Error("API Error"));
      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow(
        "Unexpected error occurred"
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
      const chunks: string[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(["Mock", " response"]);
    });

    it("should use custom options when streaming", async () => {
      const options = {
        maxTokens: 100,
        temperature: 0.8,
      };
      await claudeService.streamMessage("test prompt", options);
      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: claudeService.getModel(),
        max_tokens: 100,
        temperature: 0.8,
        messages: [{ role: "user", content: "test prompt" }],
        stream: true,
      });
    });

    it("should handle streaming errors", async () => {
      mockClient.messages.create.mockRejectedValueOnce(new Error("Streaming Error"));
      await expect(claudeService.streamMessage("test prompt")).rejects.toThrow(
        "Unexpected error occurred"
      );
    });

    it("should respect rate limiting when streaming", async () => {
      const rateLimiterInstance = vi.mocked(RateLimiter).mock.results[0].value;
      await claudeService.streamMessage("test prompt");
      expect(rateLimiterInstance.waitForSlot).toHaveBeenCalled();
    });
  });
});
