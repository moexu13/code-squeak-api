import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { validateEnv } from "../src/utils/env";

describe("Environment Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  describe("Redis URL Validation", () => {
    it("should accept valid Redis URLs", () => {
      const validUrls = [
        "redis://localhost",
        "redis://localhost:6379",
        "redis://127.0.0.1",
        "redis://127.0.0.1:6379",
        "redis://redis.example.com",
        "redis://redis.example.com:6379",
        "rediss://secure.redis.example.com",
      ];

      validUrls.forEach((url) => {
        process.env.REDIS_URL = url;
        expect(() =>
          validateEnv({
            GITHUB_TOKEN: "valid_token_that_is_at_least_40_chars_long",
            ANTHROPIC_API_KEY: "valid_key",
            REDIS_URL: url,
          })
        ).not.toThrow();
      });
    });

    it("should reject invalid Redis URLs", () => {
      const invalidUrls = [
        "http://localhost",
        "redis://",
        "localhost:6379",
        "redis://localhost:invalid",
        "redis://localhost:99999", // Invalid port
      ];

      invalidUrls.forEach((url) => {
        process.env.REDIS_URL = url;
        expect(() =>
          validateEnv({
            GITHUB_TOKEN: "valid_token_that_is_at_least_40_chars_long",
            ANTHROPIC_API_KEY: "valid_key",
            REDIS_URL: url,
          })
        ).toThrow();
      });
    });
  });

  describe("Required Environment Variables", () => {
    it("should validate all required environment variables", () => {
      const validEnv = {
        GITHUB_TOKEN: "valid_token_that_is_at_least_40_chars_long",
        ANTHROPIC_API_KEY: "valid_key",
        REDIS_URL: "redis://localhost:6379",
      };

      expect(() => validateEnv(validEnv)).not.toThrow();
    });

    it("should throw error for missing required variables", () => {
      expect(() =>
        validateEnv({
          GITHUB_TOKEN: "",
          ANTHROPIC_API_KEY: "",
          REDIS_URL: "",
        })
      ).toThrow();
    });

    it("should throw error for invalid GitHub token length", () => {
      expect(() =>
        validateEnv({
          GITHUB_TOKEN: "short",
          ANTHROPIC_API_KEY: "valid_key",
          REDIS_URL: "redis://localhost:6379",
        })
      ).toThrow();
    });
  });
});
