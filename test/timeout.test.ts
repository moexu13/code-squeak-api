import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { timeout, TIMEOUTS } from "../src/middleware/timeout";

describe("Timeout Middleware", () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
  });

  it("should allow requests that complete within timeout", async () => {
    // Add a route with a 1-second timeout
    app.get("/fast", timeout(1000), async (_req, res) => {
      // Simulate a fast operation
      await new Promise((resolve) => setTimeout(resolve, 100));
      res.json({ success: true });
    });

    const res = await request(app).get("/fast");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it("should timeout requests that take too long", async () => {
    // Add a route with a 100ms timeout
    app.get("/slow", timeout(100), async (_req, res) => {
      // Simulate a slow operation
      await new Promise((resolve) => setTimeout(resolve, 200));
      res.json({ success: true });
    });

    const res = await request(app).get("/slow");
    expect(res.status).toBe(408);
    expect(res.body).toEqual({
      error: "Request timeout",
      message: "Request processing took longer than 100ms",
      timeout: 100,
    });
  }, 5000); // Increase test timeout

  it("should use custom timeout message", async () => {
    // Add a route with custom message
    app.get(
      "/custom",
      timeout(100, "Custom timeout message"),
      async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        res.json({ success: true });
      }
    );

    const res = await request(app).get("/custom");
    expect(res.status).toBe(408);
    expect(res.body).toEqual({
      error: "Request timeout",
      message: "Custom timeout message",
      timeout: 100,
    });
  }, 5000);

  it("should have predefined timeout constants", () => {
    expect(TIMEOUTS.SHORT).toBe(5000);
    expect(TIMEOUTS.MEDIUM).toBe(15000);
    expect(TIMEOUTS.LONG).toBe(30000);
    expect(TIMEOUTS.VERY_LONG).toBe(60000);
  });
});
