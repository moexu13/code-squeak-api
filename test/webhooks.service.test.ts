import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import { StatusError } from "../src/errors/status";

// Mock environment variables
const originalEnv = process.env;

describe("Webhooks Service", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  describe("verifyWebhookSignature", () => {
    const testSecret = "test-secret";
    const testPayload = '{"test": "data"}';
    const testTimestamp = Math.floor(Date.now() / 1000).toString();

    it("should verify a valid signature", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      // Create a valid signature
      const expectedSignature = crypto
        .createHmac("sha256", testSecret)
        .update(`${testTimestamp}.${testPayload}`)
        .digest("hex");

      const signature = `sha256=${expectedSignature}`;

      const result = await verifyWebhookSignature(
        testPayload,
        signature,
        testTimestamp
      );

      expect(result.isValid).toBe(true);
      expect(result.timestamp).toBe(parseInt(testTimestamp, 10));
      expect(result.error).toBeUndefined();
    });

    it("should reject an invalid signature", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const invalidSignature = "sha256=invalid-signature";

      const result = await verifyWebhookSignature(
        testPayload,
        invalidSignature,
        testTimestamp
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Signature verification failed");
    });

    it("should reject old timestamps", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 6+ minutes old
      const signature = `sha256=${crypto
        .createHmac("sha256", testSecret)
        .update(`${oldTimestamp}.${testPayload}`)
        .digest("hex")}`;

      const result = await verifyWebhookSignature(
        testPayload,
        signature,
        oldTimestamp
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Timestamp validation failed");
    });

    it("should reject invalid signature format", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const invalidSignature = "invalid-format";

      const result = await verifyWebhookSignature(
        testPayload,
        invalidSignature,
        testTimestamp
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Invalid signature format");
    });

    it("should reject unsupported algorithms", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const signature = `sha1=some-signature`;

      const result = await verifyWebhookSignature(
        testPayload,
        signature,
        testTimestamp
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Unsupported signature algorithm");
    });

    it("should allow requests when no secret is configured", async () => {
      delete process.env.GITHUB_WEBHOOK_SECRET;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const result = await verifyWebhookSignature(
        testPayload,
        "sha256=any-signature",
        testTimestamp
      );

      expect(result.isValid).toBe(true);
      expect(result.timestamp).toBe(parseInt(testTimestamp, 10));
    });
  });

  describe("parseGitHubWebhookEvent", () => {
    it("should parse a valid webhook event", async () => {
      const { parseGitHubWebhookEvent } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const validPayload = {
        action: "opened",
        repository: {
          id: 123,
          name: "test-repo",
          full_name: "owner/test-repo",
          private: false,
        },
        sender: {
          login: "test-user",
          id: 456,
        },
      };

      const result = parseGitHubWebhookEvent(validPayload);

      expect(result).toEqual(validPayload);
    });

    it("should throw error for invalid payload structure", async () => {
      const { parseGitHubWebhookEvent } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const invalidPayload = {
        action: "opened",
        // Missing repository and sender
      };

      expect(() => parseGitHubWebhookEvent(invalidPayload)).toThrow();
    });
  });

  describe("processWebhookEvent", () => {
    it("should process a valid webhook event", async () => {
      const { processWebhookEvent } = await import(
        "../src/api/webhooks/webhooks.service"
      );

      const event = {
        action: "opened",
        repository: {
          id: 123,
          name: "test-repo",
          full_name: "owner/test-repo",
          private: false,
        },
        sender: {
          login: "test-user",
          id: 456,
        },
      };

      const result = await processWebhookEvent(event);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Webhook event processed: opened");
    });
  });
});
