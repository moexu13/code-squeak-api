import { describe, it, expect } from "vitest";
import { Sanitizer } from "../src/utils/sanitizer";

describe("Sanitizer", () => {
  describe("sanitizeText", () => {
    it("should handle null or undefined input", () => {
      expect(Sanitizer.sanitizeText(null)).toBe("");
      expect(Sanitizer.sanitizeText(undefined)).toBe("");
    });

    it("should remove HTML tags", () => {
      const input = "<script>alert('xss')</script>Hello<div>World</div>";
      expect(Sanitizer.sanitizeText(input)).toBe("Hello World");
    });

    it("should remove code blocks", () => {
      const input = "```console.log('test')```Hello```world```";
      expect(Sanitizer.sanitizeText(input)).toBe("Hello");
    });

    it("should remove inline code", () => {
      const input = "Hello `console.log('test')` World";
      expect(Sanitizer.sanitizeText(input)).toBe("Hello World");
    });

    it("should remove URLs", () => {
      const input = "Visit https://example.com and http://test.com";
      expect(Sanitizer.sanitizeText(input)).toBe("Visit and");
    });

    it("should remove special characters", () => {
      const input = "Hello! @#$%^&*() World";
      expect(Sanitizer.sanitizeText(input)).toBe("Hello World");
    });

    it("should respect maxLength", () => {
      const input = "a".repeat(100);
      expect(Sanitizer.sanitizeText(input, 50).length).toBe(50);
    });
  });

  describe("sanitizePullRequestData", () => {
    it("should sanitize all fields", () => {
      const input = {
        title: "<script>alert('xss')</script>Title",
        body: "```code```Body with <b>HTML</b>",
        user: "user<script>",
        state: "open<script>",
        url: "https://example.com",
        diff: "```diff\n-code\n+new code\n```",
      };

      const result = Sanitizer.sanitizePullRequestData(input);

      expect(result.title).toBe("Title");
      expect(result.body).toBe("Body with HTML");
      expect(result.user).toBe("user");
      expect(result.state).toBe("open");
      expect(result.url).toBe("");
      expect(result.diff).toBe("diff code new code");
    });
  });

  describe("sanitizePrompt", () => {
    it("should remove prompt injection markers", () => {
      const input = "[INST]System prompt[/INST]User prompt";
      expect(Sanitizer.sanitizePrompt(input)).toBe("System prompt User prompt");
    });

    it("should remove system prompt markers", () => {
      const input = "<|im_start|>system<|im_end|>user";
      expect(Sanitizer.sanitizePrompt(input)).toBe("system user");
    });

    it("should remove role markers", () => {
      const input = "<|user|>Hello<|assistant|>Hi";
      expect(Sanitizer.sanitizePrompt(input)).toBe("Hello Hi");
    });

    it("should remove special characters", () => {
      const input = "Hello! @#$%^&*() World";
      expect(Sanitizer.sanitizePrompt(input)).toBe("Hello World");
    });
  });
});
