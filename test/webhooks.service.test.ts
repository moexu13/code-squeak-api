import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

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
        "../src/api/webhooks/webhooks.service" as any
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
        "../src/api/webhooks/webhooks.service" as any
      );

      const invalidSignature = "sha256=invalid-signature";

      await expect(
        verifyWebhookSignature(testPayload, invalidSignature, testTimestamp)
      ).rejects.toThrowError(
        expect.objectContaining({ name: "SignatureVerificationError" })
      );
    });

    it("should reject old timestamps", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service" as any
      );

      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 6+ minutes old
      const signature = `sha256=${crypto
        .createHmac("sha256", testSecret)
        .update(`${oldTimestamp}.${testPayload}`)
        .digest("hex")}`;

      await expect(
        verifyWebhookSignature(testPayload, signature, oldTimestamp)
      ).rejects.toThrowError(
        expect.objectContaining({ name: "TimestampValidationError" })
      );
    });

    it("should reject invalid signature format", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service" as any
      );

      const invalidSignature = "invalid-format";

      await expect(
        verifyWebhookSignature(testPayload, invalidSignature, testTimestamp)
      ).rejects.toThrowError(
        expect.objectContaining({ name: "InvalidSignatureFormatError" })
      );
    });

    it("should reject unsupported algorithms", async () => {
      process.env.GITHUB_WEBHOOK_SECRET = testSecret;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service" as any
      );

      const signature = `sha1=some-signature`;

      await expect(
        verifyWebhookSignature(testPayload, signature, testTimestamp)
      ).rejects.toThrowError(
        expect.objectContaining({ name: "InvalidSignatureFormatError" })
      );
    });

    it("should allow requests when no secret is configured", async () => {
      delete process.env.GITHUB_WEBHOOK_SECRET;

      // Re-import the module after setting the environment variable
      const { verifyWebhookSignature } = await import(
        "../src/api/webhooks/webhooks.service" as any
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
        "../src/api/webhooks/webhooks.service" as any
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
        "../src/api/webhooks/webhooks.service" as any
      );

      const invalidPayload = {
        action: "opened",
        // Missing repository and sender
      };

      expect(() => parseGitHubWebhookEvent(invalidPayload)).toThrowError(
        expect.objectContaining({ name: "InvalidWebhookPayloadError" })
      );
    });
  });

  describe("processWebhookEvent", () => {
    it("should process a valid webhook event", async () => {
      const { processWebhookEvent } = await import(
        "../src/api/webhooks/webhooks.service" as any
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
