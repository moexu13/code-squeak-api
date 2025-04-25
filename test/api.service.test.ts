import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Anthropic } from "@anthropic-ai/sdk";
import { ClaudeService } from "../src/api/api.service";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const mockMessagesCreate = vi.fn();

  return {
    Anthropic: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

describe("ClaudeService", () => {
  const mockApiKey = "test-api-key";

  // Save the original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup environment variables
    process.env.ANTHROPIC_API_KEY = mockApiKey;
    process.env.CLAUDE_MODEL = "claude-test-model";

    // Reset the mock implementation
    const mockAnthropicInstance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock.results[0]
      ?.value;
    if (mockAnthropicInstance) {
      mockAnthropicInstance.messages.create.mockReset();
    }
  });

  afterEach(() => {
    // Restore original env after tests
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("should throw an error if ANTHROPIC_API_KEY is not set", () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new ClaudeService()).toThrow(
        "ANTHROPIC_API_KEY environment variable is required"
      );
    });

    it("should initialize Anthropic client with the API key", () => {
      new ClaudeService();
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: mockApiKey });
    });
  });

  describe("sendMessage", () => {
    it("should send a message with default options", async () => {
      // Setup mock response
      const mockResponse = {
        content: [{ type: "text", text: "Mock response" }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const service = new ClaudeService();
      const prompt = "Test prompt";
      const result = await service.sendMessage(prompt);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-test-model",
        max_tokens: 1024,
        temperature: 0.7,
        system: undefined,
        messages: [{ role: "user", content: prompt }],
      });
      expect(result).toBe("Mock response");
    });

    it("should send a message with custom options", async () => {
      // Setup mock response
      const mockResponse = {
        content: [{ type: "text", text: "Custom response" }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const service = new ClaudeService();
      const prompt = "Test prompt";
      const systemPrompt = "System prompt";
      const options = {
        model: "claude-custom-model",
        maxTokens: 2048,
        temperature: 0.5,
      };

      const result = await service.sendMessage(prompt, systemPrompt, options);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-custom-model",
        max_tokens: 2048,
        temperature: 0.5,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });
      expect(result).toBe("Custom response");
    });

    it("should handle unexpected response type", async () => {
      // Setup mock response with non-text type
      const mockResponse = {
        content: [{ type: "image", url: "image-url" }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const service = new ClaudeService();
      await expect(service.sendMessage("Test prompt")).rejects.toThrow(
        "Unexpected response type from Claude"
      );
    });

    it("should handle API errors", async () => {
      // Setup mock error
      const mockError = new Error("API error");

      const mockCreate = vi.fn().mockRejectedValue(mockError);
      (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const service = new ClaudeService();
      await expect(service.sendMessage("Test prompt")).rejects.toThrow(
        "Claude API Error: API error"
      );
    });
  });

  describe("streamMessage", () => {
    it("should create a readable stream", async () => {
      // Setup mock async iterator
      const mockChunks = [
        { content: [{ type: "text", text: "Chunk 1" }] },
        { content: [{ type: "text", text: "Chunk 2" }] },
      ];

      const mockAsyncIterator = {
        async *[Symbol.asyncIterator]() {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        },
      };

      const mockCreate = vi.fn().mockResolvedValue(mockAsyncIterator);
      (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const service = new ClaudeService();
      const prompt = "Test prompt";
      const stream = await service.streamMessage(prompt);

      expect(mockCreate).toHaveBeenCalledWith({
        model: "claude-test-model",
        max_tokens: 1024,
        temperature: 0.7,
        system: undefined,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it("should handle API errors during streaming", async () => {
      // Setup mock error
      const mockError = new Error("Stream error");

      const mockCreate = vi.fn().mockRejectedValue(mockError);
      (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
        messages: {
          create: mockCreate,
        },
      }));

      const service = new ClaudeService();
      await expect(service.streamMessage("Test prompt")).rejects.toThrow(
        "Claude API Error: Stream error"
      );
    });
  });
});
