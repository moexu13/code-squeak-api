import { describe, it, expect } from "vitest";
import {
  sanitizeErrorMessage,
  createSanitizedError,
} from "../src/utils/errorUtils";

describe("Error Utilities", () => {
  describe("sanitizeErrorMessage", () => {
    it("should sanitize database connection strings", () => {
      const message =
        "Failed to connect to mongodb://user:pass@localhost:27017/db";
      expect(sanitizeErrorMessage(message)).toBe(
        "Failed to connect to [CONNECTION_STRING]"
      );
    });

    it("should sanitize API keys and tokens", () => {
      const message = "Invalid API key: api_key=1234567890abcdef";
      expect(sanitizeErrorMessage(message)).toBe(
        "Invalid API key: [SENSITIVE_DATA]"
      );
    });

    it("should sanitize file paths", () => {
      const message = "Error reading /path/to/config.json";
      expect(sanitizeErrorMessage(message)).toBe("Error reading [FILE_PATH]");
    });

    it("should sanitize email addresses", () => {
      const message = "User not found: test@example.com";
      expect(sanitizeErrorMessage(message)).toBe("User not found: [EMAIL]");
    });

    it("should handle multiple sensitive data in one message", () => {
      const message =
        "Error: mongodb://user:pass@localhost/db, api_key=123, /config.json, user@example.com";
      const expected =
        "Error: [CONNECTION_STRING], [SENSITIVE_DATA], [FILE_PATH], [EMAIL]";
      expect(sanitizeErrorMessage(message)).toBe(expected);
    });
  });

  describe("createSanitizedError", () => {
    it("should create sanitized error object from Error instance", () => {
      const error = new Error(
        "Failed to connect to mongodb://user:pass@localhost/db"
      );
      const req = {
        method: "GET",
        originalUrl: "/api/test",
        path: "/test",
        query: { id: "123" },
        headers: {
          "content-type": "application/json",
          "user-agent": "test-agent",
        },
      };

      const result = createSanitizedError(error, req);

      expect(result).toMatchObject({
        name: "Error",
        message: "Failed to connect to [CONNECTION_STRING]",
        stack: error.stack,
        request: {
          method: "GET",
          url: "/api/test",
          path: "/test",
          query: { id: "123" },
          headers: {
            "content-type": "application/json",
            "user-agent": "test-agent",
          },
        },
      });
    });

    it("should handle non-Error objects", () => {
      const error = "String error";
      const req = {
        method: "POST",
        originalUrl: "/api/test",
        path: "/test",
        query: {},
        headers: {},
      };

      const result = createSanitizedError(error, req);

      expect(result).toMatchObject({
        name: "UnknownError",
        message: "An unknown error occurred",
        stack: undefined,
        request: {
          method: "POST",
          url: "/api/test",
          path: "/test",
          query: {},
          headers: {},
        },
      });
    });
  });
});
