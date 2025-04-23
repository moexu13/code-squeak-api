// Set up environment variables before importing app
import { config } from "dotenv";
config();

// Set environment variables for testing
if (!process.env.GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN environment variable is required for tests");
}
process.env.REDIS_URL = "redis://localhost:6379";
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.LOG_LEVEL = "info";

console.log("Test environment setup:", {
  hasToken: !!process.env.GITHUB_TOKEN,
  tokenLength: process.env.GITHUB_TOKEN?.length,
  redisUrl: process.env.REDIS_URL,
  hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  logLevel: process.env.LOG_LEVEL,
});

import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import apiRouter from "../src/api/api.routes";
import logger from "../src/utils/logger";

// Create a test app that doesn't validate the environment
const testApp = new Hono();

// Root route
testApp.get("/", (c) => {
  logger.info({ context: "App" }, "Root route accessed");
  return c.text("Code Squeak API");
});

// Mount the API routes
testApp.route("/v1/api", apiRouter);

describe("API Endpoints", () => {
  let server: ReturnType<typeof serve>;

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  it("GET / should return 200", async () => {
    server = serve(testApp);
    const response = await request(server).get("/");
    expect(response.status).toBe(200);
  });

  it("GET /v1/api/octocat/Hello-World should return pull requests", async () => {
    server = serve(testApp);
    const response = await request(server).get("/v1/api/octocat/Hello-World");
    console.log("API Response:", {
      status: response.status,
      body: response.body,
      error: response.error,
    });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("pullRequests");
    expect(Array.isArray(response.body.pullRequests)).toBe(true);
  });
});
