import { describe, it, expect } from "vitest";
import {
  validateAndSanitizeParams,
  MAX_DIFF_SIZE,
  MAX_STRING_LENGTH,
} from "../src/utils/validation";
import { BadRequestError } from "../src/errors/http";
import { AnalysisParams } from "../src/api/analysis/analysis.service";

describe("Validation Utils", () => {
  describe("validateAndSanitizeParams", () => {
    it("should validate and sanitize valid parameters", () => {
      const params: AnalysisParams = {
        diff: "test diff",
        title: "Test PR",
        description: "Test description",
        author: "Test Author",
        state: "open",
        url: "https://test.com",
      };

      const result = validateAndSanitizeParams(params);

      expect(result).toEqual({
        title: "Test PR",
        description: "Test description",
        author: "Test Author",
        state: "open",
        url: "https://test.com",
        diff: "[SCRUBBED: 9 chars]",
      });
    });

    it("should throw BadRequestError if diff is not a string", () => {
      const params = {
        diff: 123,
      } as unknown as AnalysisParams;

      expect(() => validateAndSanitizeParams(params)).toThrow(BadRequestError);
      expect(() => validateAndSanitizeParams(params)).toThrow(
        "Diff must be a string"
      );
    });

    it("should throw BadRequestError if diff exceeds MAX_DIFF_SIZE", () => {
      const params: AnalysisParams = {
        diff: "a".repeat(MAX_DIFF_SIZE + 1),
      };

      expect(() => validateAndSanitizeParams(params)).toThrow(BadRequestError);
      expect(() => validateAndSanitizeParams(params)).toThrow(
        `Diff size exceeds maximum allowed size of ${MAX_DIFF_SIZE} bytes`
      );
    });

    it("should truncate string parameters to MAX_STRING_LENGTH", () => {
      const longString = "a".repeat(MAX_STRING_LENGTH + 100);
      const params: AnalysisParams = {
        diff: "test diff",
        title: longString,
        description: longString,
        author: longString,
        state: longString,
        url: longString,
      };

      const result = validateAndSanitizeParams(params);

      if (
        "title" in result &&
        "description" in result &&
        "author" in result &&
        "state" in result &&
        "url" in result
      ) {
        expect((result.title as string).length).toBe(MAX_STRING_LENGTH);
        expect((result.description as string).length).toBe(MAX_STRING_LENGTH);
        expect((result.author as string).length).toBe(MAX_STRING_LENGTH);
        expect((result.state as string).length).toBe(MAX_STRING_LENGTH);
        expect((result.url as string).length).toBe(MAX_STRING_LENGTH);
      }
    });

    it("should preserve non-string parameters", () => {
      const params: AnalysisParams = {
        diff: "test diff",
        max_tokens: 1000,
        temperature: 0.5,
      };

      const result = validateAndSanitizeParams(params);

      expect(result.max_tokens).toBe(1000);
      expect(result.temperature).toBe(0.5);
    });

    it("should handle undefined optional parameters", () => {
      const params: AnalysisParams = {
        diff: "test diff",
      };

      const result = validateAndSanitizeParams(params);

      expect(result).toEqual({
        diff: "[SCRUBBED: 9 chars]",
      });
    });
  });
});
