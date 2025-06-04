import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import logger from "../src/utils/logger";

// Mock Sentry
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import * as Sentry from "@sentry/node";

describe("Logger", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;
  const mockConsole = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    // Reset environment
    process.env.NODE_ENV = "development";
    process.env.LOG_LEVEL = "debug";

    // Reset logger instance
    logger.reset();

    // Mock console methods
    vi.spyOn(console, "debug").mockImplementation(mockConsole.debug);
    vi.spyOn(console, "info").mockImplementation(mockConsole.info);
    vi.spyOn(console, "warn").mockImplementation(mockConsole.warn);
    vi.spyOn(console, "error").mockImplementation(mockConsole.error);
  });

  afterEach(() => {
    // Restore environment
    process.env.NODE_ENV = originalEnv;
    process.env.LOG_LEVEL = originalLogLevel;
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe("in production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should send errors to Sentry but not console", () => {
      logger.error({
        message: "Failed to fetch GitHub repository",
        context: {
          owner: "test-org",
          repo: "test-repo",
          status: 404,
        },
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          level: "error",
          extra: expect.objectContaining({
            context: {
              owner: "test-org",
              repo: "test-repo",
              status: 404,
            },
          }),
        })
      );
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it("should not log non-error levels to console", () => {
      logger.debug({ message: "Test debug" });
      logger.info({ message: "Test info" });
      logger.warn({ message: "Test warn" });

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });
  });

  describe("in development", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
      process.env.LOG_LEVEL = "debug";
    });

    it("should log errors to console but not Sentry", () => {
      logger.error({
        message: "Failed to fetch GitHub repository",
        context: {
          owner: "test-org",
          repo: "test-repo",
          status: 404,
        },
      });

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining("ERROR: Failed to fetch GitHub repository"),
        expect.objectContaining({
          context: {
            owner: "test-org",
            repo: "test-repo",
            status: 404,
          },
        })
      );
    });

    it("should log all levels to console", () => {
      logger.debug({ message: "Test debug" });
      logger.info({ message: "Test info" });
      logger.warn({ message: "Test warn" });
      logger.error({ message: "Test error" });

      expect(mockConsole.debug).toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe("log level filtering", () => {
    it("should respect LOG_LEVEL environment variable", () => {
      process.env.LOG_LEVEL = "warn";
      logger.reset();

      logger.debug({ message: "Test debug" });
      logger.info({ message: "Test info" });
      logger.warn({ message: "Test warn" });
      logger.error({ message: "Test error" });

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });
});
