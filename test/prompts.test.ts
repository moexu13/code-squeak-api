import { describe, it, expect } from "vitest";
import { DEFAULT_REVIEW_PROMPT } from "../src/api/analysis/prompts";

describe("Prompts", () => {
  describe("DEFAULT_REVIEW_PROMPT", () => {
    it("should contain all required template variables", () => {
      const requiredVars = [
        "{title}",
        "{description}",
        "{author}",
        "{state}",
        "{url}",
        "{diff}",
      ];
      requiredVars.forEach((variable) => {
        expect(DEFAULT_REVIEW_PROMPT).toContain(variable);
      });
    });

    it("should contain all required analysis sections", () => {
      const requiredSections = [
        "Code quality and maintainability",
        "Idiomatic code and adherence to best practices",
        "Potential bugs or edge cases",
        "Security implications",
        "Performance considerations",
      ];
      requiredSections.forEach((section) => {
        expect(DEFAULT_REVIEW_PROMPT).toContain(section);
      });
    });

    it("should format correctly with template variables", () => {
      const formatted = DEFAULT_REVIEW_PROMPT.replace("{title}", "Test PR")
        .replace("{description}", "Test description")
        .replace("{author}", "Test Author")
        .replace("{state}", "open")
        .replace("{url}", "https://test.com")
        .replace("{diff}", "test diff");

      expect(formatted).not.toContain("{title}");
      expect(formatted).not.toContain("{description}");
      expect(formatted).not.toContain("{author}");
      expect(formatted).not.toContain("{state}");
      expect(formatted).not.toContain("{url}");
      expect(formatted).not.toContain("{diff}");
      expect(formatted).toContain("Test PR");
      expect(formatted).toContain("Test description");
      expect(formatted).toContain("Test Author");
      expect(formatted).toContain("open");
      expect(formatted).toContain("https://test.com");
      expect(formatted).toContain("test diff");
    });
  });
});
