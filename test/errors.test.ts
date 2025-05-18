import { describe, it, expect } from "vitest";
import request from "supertest";
import express, { RequestHandler } from "express";
import notFound from "../src/errors/notFound";
import methodNotAllowed from "../src/errors/methodNotAllowed";
import errorHandler from "../src/errors/errorHandler";

describe("Error Handlers", () => {
  const app = express();

  // Test routes
  const testHandler: RequestHandler = (_req, res, next) => {
    res.send("OK");
    next();
  };
  app.get("/test", testHandler);
  app.post("/test", testHandler);

  // Error handlers
  app.use(notFound);
  app.use(errorHandler);

  it("should return 404 for non-existent routes", async () => {
    const response = await request(app).get("/non-existent").expect(404);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("Not found");
  });

  it("should return 405 for method not allowed", async () => {
    const app = express();
    app.get("/test", testHandler);
    app.all("/test", methodNotAllowed);
    app.use(errorHandler);

    const response = await request(app).post("/test").expect(405);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toContain("not allowed");
  });

  it("should handle internal server errors", async () => {
    const app = express();
    app.get("/error", () => {
      throw new Error("Test error");
    });
    app.use(errorHandler);

    const response = await request(app).get("/error").expect(500);

    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toBe("Test error");
  });

  it("should include stack trace in development", async () => {
    process.env.NODE_ENV = "development";
    const app = express();
    app.get("/error", () => {
      throw new Error("Test error");
    });
    app.use(errorHandler);

    const response = await request(app).get("/error").expect(500);

    expect(response.body).toHaveProperty("stack");
    process.env.NODE_ENV = "test";
  });
});
