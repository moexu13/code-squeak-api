import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express, { RequestHandler } from "express";
import { NotFoundError, MethodNotAllowedError } from "../src/errors/http";
import errorHandler from "../src/errors/errorHandler";
import logger from "../src/utils/logger";

// Mock the logger
vi.mock("../src/utils/logger", () => ({
  default: {
    error: vi.fn(),
  },
}));

describe("Error Handlers", () => {
  const app = express();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test routes
  const testHandler: RequestHandler = (_req, res, next) => {
    res.send("OK");
    next();
  };
  app.get("/test", testHandler);
  app.post("/test", testHandler);

  // Error handlers
  app.use((req, _res, next) => {
    next(new NotFoundError(`Not found: ${req.originalUrl}`));
  });
  app.use((req, _res, next) => {
    next(
      new MethodNotAllowedError(
        `${req.method} not allowed for ${req.originalUrl}`
      )
    );
  });
  app.use(errorHandler);

  it("should return 404 for non-existent routes", async () => {
    const response = await request(app).get("/non-existent").expect(404);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toBe("Something went wrong");
    expect(logger.error).toHaveBeenCalledWith({
      message: "Express error occurred",
      error: expect.objectContaining({
        name: "NotFoundError",
        message: expect.stringContaining("Not found"),
      }),
    });
  });

  it("should return 405 for method not allowed", async () => {
    const app = express();
    app.get("/test", testHandler);
    app.all("/test", (req, _res, next) => {
      next(
        new MethodNotAllowedError(
          `${req.method} not allowed for ${req.originalUrl}`
        )
      );
    });
    app.use(errorHandler);

    const response = await request(app).post("/test").expect(405);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toBe("Something went wrong");
    expect(logger.error).toHaveBeenCalledWith({
      message: "Express error occurred",
      error: expect.objectContaining({
        name: "MethodNotAllowedError",
        message: expect.stringContaining("not allowed"),
      }),
    });
  });

  it("should handle internal server errors", async () => {
    const app = express();
    app.get("/error", () => {
      throw new Error("Test error");
    });
    app.use(errorHandler);

    const response = await request(app).get("/error").expect(500);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toBe("Something went wrong");
    expect(logger.error).toHaveBeenCalledWith({
      message: "Express error occurred",
      error: expect.objectContaining({
        name: "Error",
        message: "Test error",
      }),
    });
  });

  it("should include stack trace in development", async () => {
    process.env.NODE_ENV = "development";
    const app = express();
    app.get("/error", () => {
      throw new Error("Test error");
    });
    app.use(errorHandler);

    const response = await request(app).get("/error").expect(500);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toBe("Something went wrong");
    expect(logger.error).toHaveBeenCalledWith({
      message: "Express error occurred",
      error: expect.objectContaining({
        name: "Error",
        message: "Test error",
        stack: expect.any(String),
      }),
    });
    process.env.NODE_ENV = "test";
  });
});
