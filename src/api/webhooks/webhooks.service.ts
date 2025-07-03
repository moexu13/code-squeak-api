import crypto from "crypto";
import logger from "../../utils/logger";
import { StatusError } from "../../errors/status";
import {
  WebhookPayload,
  WebhookVerificationResult,
  GitHubWebhookEvent,
} from "./webhooks.types";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  logger.warn({
    message:
      "GITHUB_WEBHOOK_SECRET not set - webhook signature verification will be disabled",
  });
}

/**
 * Verifies the signature of a GitHub webhook request
 * @param payload - The raw request body
 * @param signature - The signature header from GitHub
 * @param timestamp - The timestamp header from GitHub
 * @returns WebhookVerificationResult with validation status
 */
export async function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  timestamp: string
): Promise<WebhookVerificationResult> {
  try {
    // Check if webhook secret is configured
    if (!WEBHOOK_SECRET) {
      logger.warn({
        message:
          "Webhook signature verification skipped - no secret configured",
      });
      return {
        isValid: true,
        timestamp: parseInt(timestamp, 10),
      };
    }

    // Validate timestamp to prevent replay attacks
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - timestampNum);

    // Allow 5 minutes of clock skew
    if (timeDiff > 300) {
      logger.warn({
        message: "Webhook timestamp too old or too new",
        timestamp: timestampNum,
        now,
        timeDiff,
      });
      return {
        isValid: false,
        error: "Timestamp validation failed",
        timestamp: timestampNum,
      };
    }

    // Parse the signature header
    const signatureParts = signature.split("=");
    if (signatureParts.length !== 2) {
      logger.warn({
        message: "Invalid signature format",
        signature,
      });
      return {
        isValid: false,
        error: "Invalid signature format",
        timestamp: timestampNum,
      };
    }

    const algorithm = signatureParts[0];
    const providedSignature = signatureParts[1];

    // Validate algorithm
    if (algorithm !== "sha256") {
      logger.warn({
        message: "Unsupported signature algorithm",
        algorithm,
      });
      return {
        isValid: false,
        error: "Unsupported signature algorithm",
        timestamp: timestampNum,
      };
    }

    // Create the expected signature
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    // Compare signatures
    let isValid = false;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(providedSignature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch (err) {
      // This error occurs if the signature lengths don't match
      logger.warn({
        message: "Signature length mismatch during verification",
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        isValid: false,
        error: "Signature verification failed",
        timestamp: timestampNum,
      };
    }

    if (!isValid) {
      logger.warn({
        message: "Webhook signature verification failed",
        providedSignature,
        expectedSignature: expectedSignature.substring(0, 8) + "...",
      });
    }

    return {
      isValid,
      error: isValid ? undefined : "Signature verification failed",
      timestamp: timestampNum,
    };
  } catch (error) {
    logger.error({
      message: "Error during webhook signature verification",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      isValid: false,
      error: "Internal verification error",
    };
  }
}

/**
 * Parses and validates a GitHub webhook event
 * @param payload - The webhook payload
 * @returns Parsed GitHub webhook event
 */
export function parseGitHubWebhookEvent(
  payload: WebhookPayload
): GitHubWebhookEvent {
  try {
    // Basic validation of required fields
    if (!payload.action || !payload.repository || !payload.sender) {
      throw new StatusError("Invalid webhook payload structure", 400);
    }

    return payload as GitHubWebhookEvent;
  } catch (error) {
    if (error instanceof StatusError) {
      throw error;
    }
    throw new StatusError("Failed to parse webhook payload", 400);
  }
}

/**
 * Processes a verified webhook event
 * @param event - The parsed webhook event
 * @returns Processing result
 */
export async function processWebhookEvent(event: GitHubWebhookEvent): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    logger.info({
      message: "Processing webhook event",
      action: event.action,
      repository: event.repository.full_name,
      sender: event.sender.login,
    });

    // TODO: Implement specific webhook event processing logic
    // This could include:
    // - Triggering code analysis for pull requests
    // - Updating repository metadata
    // - Sending notifications
    // - etc.

    return {
      success: true,
      message: `Webhook event processed: ${event.action}`,
    };
  } catch (error) {
    logger.error({
      message: "Error processing webhook event",
      error: error instanceof Error ? error.message : String(error),
      event: {
        action: event.action,
        repository: event.repository.full_name,
      },
    });
    throw error;
  }
}
