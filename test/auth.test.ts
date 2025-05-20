import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import authMiddleware from "../src/middleware/auth";

// Mock the Unkey client
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

// Set test environment
process.env.NODE_ENV = "test";

describe("Authentication Middleware", () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    // Add a test endpoint that requires authentication
    app.get("/test", authMiddleware, (_, res) => {
      res.status(200).send("Authenticated");
    });
  });

  it("should return 401 when no API key is provided", async () => {
    const response = await request(app).get("/test");
    expect(response.status).toBe(401);
    expect(response.text).toBe("Unauthorized");
  });

  it("should return 401 when invalid API key is provided", async () => {
    const response = await request(app)
      .get("/test")
      .set("Authorization", "Bearer invalid-key");
    expect(response.status).toBe(401);
    expect(response.text).toBe("Unauthorized");
  });

  it("should return 200 when valid API key is provided", async () => {
    const response = await request(app)
      .get("/test")
      .set("Authorization", "Bearer valid-key");
    expect(response.status).toBe(200);
    expect(response.text).toBe("Authenticated");
  });
});
