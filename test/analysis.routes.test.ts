import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import authMiddleware from "../src/middleware/auth";
import analysisRouter from "../src/api/analysis/analysis.routes";
import { NotFoundError } from "../src/errors/http";

// Mock the Unkey client to accept 'valid-key'
vi.mock("@unkey/api", () => ({
  Unkey: vi.fn().mockImplementation(() => ({
    keys: {
      verify: vi.fn().mockImplementation(async ({ key }) => {
        if (key === "valid-key") {
          return { result: { valid: true }, error: null };
        }
        return { result: { valid: false }, error: new Error("Invalid key") };
      }),
    },
  })),
}));

describe("Analysis Route Integration", () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();

    // Mount the analysis router with auth middleware
    app.use("/api/v1/code-analysis", authMiddleware, analysisRouter);

    // Add 404 handler
    app.use((req, _res, next) => {
      next(new NotFoundError(`Not found: ${req.originalUrl}`));
    });

    // Add error handler
    app.use((err: any, _req: any, res: any, _next: any) => {
      if (err instanceof NotFoundError) {
        res.status(404).json({
          error: "Something went wrong",
          message: err.message,
        });
      } else {
        res.status(err.status || 500).json({
          error: "Something went wrong",
          message: err.message,
        });
      }
    });
  });

  it("should return 200 for a valid analysis test route", async () => {
    const res = await request(app)
      .get("/api/v1/code-analysis/test")
      .set("Authorization", "Bearer valid-key");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  it("should return 401 for missing API key", async () => {
    const res = await request(app).get("/api/v1/code-analysis/test");
    expect(res.status).toBe(401);
  });

  it("should return 404 for an unknown route", async () => {
    const res = await request(app)
      .get("/api/v1/does-not-exist")
      .set("Authorization", "Bearer valid-key");
    expect(res.status).toBe(404);
  });
});
