import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { config } from "dotenv";
import { validateEnv } from "../src/utils/env";
import { app, handler } from "../src/index";

// Mock dependencies before imports
vi.mock("dotenv");
vi.mock("../src/utils/env");
vi.mock("../src/utils/logger", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock GitHub service
vi.mock("../src/api/github.service", () => ({
  GitHubService: class {
    listPullRequests = vi.fn().mockResolvedValue([{ id: 1, title: "Test PR" }]);
  },
}));

// Mock validation
vi.mock("../src/utils/validator", () => ({
  validatePullRequestParams: vi.fn(),
  ValidationError: class extends Error {},
}));

describe("index.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up test environment variables
    process.env.GITHUB_TOKEN = "ghp_1234567890123456789012345678901234567890";
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.LOG_LEVEL = "info";

    // Call the config function to load environment variables
    config();

    // Call validateEnv with the expected values
    validateEnv({
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      ANTHROPIC_API_KEY: "test-key",
      REDIS_URL: "redis://localhost:6379",
      LOG_LEVEL: "info",
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe("Environment Setup", () => {
    it("should load environment variables", () => {
      expect(config).toHaveBeenCalled();
    });

    it("should validate environment variables", () => {
      expect(validateEnv).toHaveBeenCalledWith({
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        ANTHROPIC_API_KEY: "test-key",
        REDIS_URL: "redis://localhost:6379",
        LOG_LEVEL: "info",
      });
    });
  });

  describe("App Routes", () => {
    it("should respond to root route", async () => {
      const response = await app.request("/");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Code Squeak API");
    });

    it("should mount API routes", async () => {
      const response = await app.request("/v1/api");
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("API is running");
    });

    it("should handle GitHub API routes", async () => {
      const response = await app.request("/v1/api/testowner/testrepo");
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("pullRequests");
      expect(data.pullRequests).toHaveLength(1);
      expect(data.pullRequests[0]).toHaveProperty("title", "Test PR");
    });
  });

  describe("Exports", () => {
    it("should export app for testing", () => {
      expect(app).toBeDefined();
      expect(app.routes).toBeDefined();
    });

    it("should export handler for AWS Lambda", () => {
      expect(handler).toBeDefined();
      expect(typeof handler).toBe("function");
    });

    it("should export default app for Vite dev server", async () => {
      const { default: defaultApp } = await import("../src/index");
      expect(defaultApp).toBe(app);
    });
  });
});
