import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import { app } from "../src/index";
import { serve } from "@hono/node-server";

describe("API Endpoints", () => {
  // Store server reference for cleanup
  let server: ReturnType<typeof serve>;

  // Close server after each test
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
});
