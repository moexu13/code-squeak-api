import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ClaudeService } from "../src/api/services/claude/service";
import {
  ClaudeRateLimitError,
  ClaudeAuthenticationError,
  ClaudeTokenLimitError,
  ClaudeTimeoutError,
} from "../src/utils/claudeErrors";
import * as claudeUtils from "../src/utils/claudeUtils";

// Mock the Anthropic client
const mockClient = {
  messages: {
    create: vi.fn().mockImplementation(async ({ stream }) => {
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
const mockWaitForSlot = vi.fn().mockResolvedValue(undefined);
vi.mock("../src/utils/rateLimiter", () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    waitForSlot: mockWaitForSlot,
  })),
}));

// Mock the CircuitBreaker
const mockExecute = vi.fn().mockImplementation((fn) => fn());
vi.mock("../src/utils/circuitBreaker", () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: mockExecute,
    getState: vi.fn().mockReturnValue("CLOSED"),
  })),
}));

// Mock logger
vi.mock("../src/utils/logger", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Direct mock of ClaudeError classes
vi.mock("../src/utils/claudeErrors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/utils/claudeErrors")>();
  return {
    ...actual,
    ClaudeTokenLimitError: class extends actual.ClaudeError {
      maxTokens: number;
      constructor(message: string, maxTokens: number) {
        super(message);
        this.maxTokens = maxTokens;
        this.name = "ClaudeTokenLimitError";
      }
    },
  };
});

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
      CLAUDE_TIMEOUT: "2000",
    };
    claudeService = new ClaudeService();
    vi.clearAllMocks();
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
      delete process.env.CLAUDE_TIMEOUT;
      const service = new ClaudeService();
      expect(service).toBeInstanceOf(ClaudeService);
    });
  });

  describe("sendMessage", () => {
    it("should send message with default options", async () => {
      const response = await claudeService.sendMessage("test prompt");
      expect(response).toBe("Mock response");
      expect(mockExecute).toHaveBeenCalled();
      expect(mockWaitForSlot).toHaveBeenCalled();
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

    it("should handle rate limit errors", async () => {
      // Clear previous mock implementation
      mockClient.messages.create.mockReset();

      // Setup for this specific test case only
      mockClient.messages.create.mockRejectedValueOnce(
        new Error("Anthropic API rate limit exceeded. Please retry after 60 seconds.")
      );

      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow("Rate limit exceeded");

      // Reset mock again
      mockClient.messages.create.mockReset();

      // Setup for the second assertion
      mockClient.messages.create.mockRejectedValueOnce(
        new Error("Anthropic API rate limit exceeded. Please retry after 60 seconds.")
      );

      await expect(claudeService.sendMessage("test prompt")).rejects.toBeInstanceOf(
        ClaudeRateLimitError
      );
    });

    it("should extract retry-after from rate limit error", async () => {
      mockClient.messages.create.mockRejectedValueOnce(
        new Error("Anthropic API rate limit exceeded. Please retry after 30 seconds.")
      );

      try {
        await claudeService.sendMessage("test prompt");
        expect.fail("Expected an error to be thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ClaudeRateLimitError);
        expect((error as ClaudeRateLimitError).retryAfter).toBe(30000);
      }
    });

    it("should handle authentication errors", async () => {
      // Clear previous mock implementation
      mockClient.messages.create.mockReset();

      // Setup for this specific test case only
      mockClient.messages.create.mockRejectedValueOnce(
        new Error("Failed authentication with Anthropic API")
      );

      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow(
        "Authentication failed"
      );

      // Reset mock again
      mockClient.messages.create.mockReset();

      // Setup for the second assertion
      mockClient.messages.create.mockRejectedValueOnce(
        new Error("Failed authentication with Anthropic API")
      );

      await expect(claudeService.sendMessage("test prompt")).rejects.toBeInstanceOf(
        ClaudeAuthenticationError
      );
    });

    it("should handle token limit errors", async () => {
      // Use a different approach to test token limit errors
      // Create a fake error that will match our pattern
      const tokenLimitError = new Error("token limit exceeded for this model. max tokens: 4096");

      // Create a spy on the actual utility function
      const extractSpy = vi.spyOn(claudeUtils, "extractMaxTokens");
      extractSpy.mockReturnValueOnce(4096);

      // Mock the request to throw the error
      mockClient.messages.create.mockRejectedValueOnce(tokenLimitError);

      // Test that we get a ClaudeTokenLimitError
      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow(
        "Token limit exceeded"
      );

      // Check if extraction method was called with the right message and default max tokens
      expect(extractSpy).toHaveBeenCalledWith(tokenLimitError.message, 500);
    });

    it("should handle timeout errors from API", async () => {
      // Clear previous mock implementation
      mockClient.messages.create.mockReset();

      // Setup for this specific test case only
      mockClient.messages.create.mockRejectedValueOnce(new Error("Request timeout exceeded"));

      await expect(claudeService.sendMessage("test prompt")).rejects.toThrow("Request timed out");

      // Reset mock again
      mockClient.messages.create.mockReset();

      // Setup for the second assertion
      mockClient.messages.create.mockRejectedValueOnce(new Error("Request timeout exceeded"));

      await expect(claudeService.sendMessage("test prompt")).rejects.toBeInstanceOf(
        ClaudeTimeoutError
      );
    });

    it("should handle timeout when request takes too long", { timeout: 10000 }, async () => {
      // Mock the makeRequest method directly
      const claudeServiceAny = claudeService as any;
      const origMakeRequest = claudeServiceAny.makeRequest;

      // Replace the method with our mocked version that mimics a timeout
      claudeServiceAny.makeRequest = vi
        .fn()
        .mockRejectedValue(new ClaudeTimeoutError("Request timed out after 2000ms"));

      try {
        await expect(claudeService.sendMessage("test prompt")).rejects.toThrow("Request timed out");
        await expect(claudeService.sendMessage("test prompt")).rejects.toBeInstanceOf(
          ClaudeTimeoutError
        );
      } finally {
        // Restore the original method
        claudeServiceAny.makeRequest = origMakeRequest;
      }
    });
  });

  describe("streamMessage", () => {
    it("should stream message with default options", async () => {
      // Mock the implementation to ensure we return a properly structured async iterable
      mockClient.messages.create.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "Mock" } };
          yield { type: "content_block_delta", delta: { type: "text_delta", text: " response" } };
        },
      });

      const stream = await claudeService.streamMessage("test prompt");
      const chunks: string[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(["Mock", " response"]);
    });

    it("should use custom options when streaming", async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "Test" } };
        },
      });

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
      mockClient.messages.create.mockRejectedValueOnce(new Error("Stream error"));
      await expect(claudeService.streamMessage("test prompt")).rejects.toThrow(
        "Unexpected error occurred"
      );
    });

    it("should handle empty stream chunks", async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "text" } };
          yield { type: "other_type" }; // Not a text_delta
          yield { type: "content_block_delta", delta: { type: "other_delta" } }; // Not a text_delta
        },
      });

      const stream = await claudeService.streamMessage("test prompt");
      const chunks: string[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(["text", "", ""]);
    });

    it("should handle rate limit errors during streaming", async () => {
      mockClient.messages.create.mockRejectedValueOnce(
        new Error("Anthropic API rate limit exceeded. Please retry after 60 seconds.")
      );

      await expect(claudeService.streamMessage("test prompt")).rejects.toThrow(
        "Rate limit exceeded"
      );
    });

    it("should respect rate limiting when streaming", async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "Test" } };
        },
      });

      await claudeService.streamMessage("test prompt");
      expect(mockWaitForSlot).toHaveBeenCalled();
    });

    it("should use the circuit breaker for streaming", async () => {
      mockClient.messages.create.mockResolvedValueOnce({
        [Symbol.asyncIterator]: async function* () {
          yield { type: "content_block_delta", delta: { type: "text_delta", text: "Test" } };
        },
      });

      await claudeService.streamMessage("test prompt");
      expect(mockExecute).toHaveBeenCalled();
    });

    it("should handle timeout for streaming", { timeout: 10000 }, async () => {
      // Mock the makeRequest method directly
      const claudeServiceAny = claudeService as any;
      const origMakeRequest = claudeServiceAny.makeRequest;

      // Replace the method with our mocked version that mimics a timeout
      claudeServiceAny.makeRequest = vi
        .fn()
        .mockRejectedValue(new ClaudeTimeoutError("Request timed out after 2000ms"));

      try {
        await expect(claudeService.streamMessage("test prompt")).rejects.toThrow(
          "Request timed out"
        );
      } finally {
        // Restore the original method
        claudeServiceAny.makeRequest = origMakeRequest;
      }
    });
  });

  describe("getModel", () => {
    it("should return the configured model", () => {
      expect(claudeService.getModel()).toBe("test-model");
    });
  });

  describe("Error handling", () => {
    it("should extract retry-after time from error message", () => {
      expect(claudeUtils.extractRetryAfter("please retry after 60 seconds")).toBe(60000);
      expect(claudeUtils.extractRetryAfter("some other message")).toBeUndefined();
    });

    it("should extract max tokens from error message", () => {
      expect(claudeUtils.extractMaxTokens("max tokens: 2000", 500)).toBe(2000);
      expect(claudeUtils.extractMaxTokens("some other message", 500)).toBe(500); // Default from our test setup
    });
  });
});
