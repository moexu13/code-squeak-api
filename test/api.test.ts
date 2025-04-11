import { describe, it, expect, afterEach, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/index";
import { serve } from "@hono/node-server";
import { config } from "dotenv";

describe("API Endpoints", () => {
  let server: ReturnType<typeof serve>;

  beforeAll(() => {
    // Load environment variables from .env file
    config();

    // Set environment variables for testing
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN environment variable is required for tests");
    }
    console.log("Test environment setup:", {
      hasToken: !!process.env.GITHUB_TOKEN,
      tokenLength: process.env.GITHUB_TOKEN?.length,
    });
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  it("GET / should return 200", async () => {
    server = serve(app);
    const response = await request(server).get("/");
    expect(response.status).toBe(200);
  });

  it("GET /v1/api/octocat/Hello-World should return pull requests", async () => {
    server = serve(app);
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
