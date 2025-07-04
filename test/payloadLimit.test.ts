import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { payloadLimit, PAYLOAD_LIMITS } from "../src/middleware/payloadLimit";

describe("Payload Limit Middleware", () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
  });

  it("should allow requests within payload limit", async () => {
    // Add a route with 1KB limit
    app.post("/test", payloadLimit(PAYLOAD_LIMITS.TINY), (req, res) => {
      res.json({ success: true, data: req.body });
    });

    const smallPayload = { test: "data" };
    const res = await request(app)
      .post("/test")
      .set("Content-Type", "application/json")
      .send(smallPayload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: smallPayload });
  });

  it("should reject requests exceeding payload limit", async () => {
    // Add a route with 100 bytes limit
    app.post("/limited", payloadLimit(100), (req, res) => {
      res.json({ success: true });
    });

    // Create a payload that's larger than 100 bytes
    const largePayload = {
      data: "x".repeat(200), // 200 characters = more than 100 bytes
    };

    const res = await request(app)
      .post("/limited")
      .set("Content-Type", "application/json")
      .send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: "Payload too large",
      message: "Payload too large. Maximum size is 100 Bytes",
      maxSize: "100 Bytes",
      receivedSize: expect.stringMatching(/^\d+(\.\d+)? \w+$/),
    });
  });

  it("should use custom error message", async () => {
    // Add a route with custom message
    app.post(
      "/custom",
      payloadLimit(50, "Custom payload limit exceeded"),
      (req, res) => {
        res.json({ success: true });
      }
    );

    const largePayload = { data: "x".repeat(100) };

    const res = await request(app)
      .post("/custom")
      .set("Content-Type", "application/json")
      .send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body.message).toBe("Custom payload limit exceeded");
  });

  it("should have predefined payload limit constants", () => {
    expect(PAYLOAD_LIMITS.TINY).toBe(1024);
    expect(PAYLOAD_LIMITS.SMALL).toBe(10240);
    expect(PAYLOAD_LIMITS.MEDIUM).toBe(102400);
    expect(PAYLOAD_LIMITS.LARGE).toBe(1048576);
    expect(PAYLOAD_LIMITS.VERY_LARGE).toBe(5242880);
  });

  it("should handle requests without content-length header", async () => {
    // Add a route with limit
    app.post("/no-length", payloadLimit(100), (req, res) => {
      res.json({ success: true });
    });

    const res = await request(app)
      .post("/no-length")
      .set("Content-Type", "application/json")
      .send({ test: "data" });

    // Should pass since content-length is not set
    expect(res.status).toBe(200);
  });
});
