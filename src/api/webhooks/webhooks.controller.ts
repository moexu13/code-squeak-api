import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import {
  verifyWebhookSignature,
  parseGitHubWebhookEvent,
  processWebhookEvent,
} from "./webhooks.service";
import {
  MissingSignatureError,
  InvalidWebhookPayloadError,
  SignatureVerificationError,
} from "../../errors/webhook";
import logger from "../../utils/logger";

/**
 * Handles incoming GitHub webhook requests
 * Verifies the signature and processes the event
 */
async function handleWebhook(req: Request, res: Response) {
  const signature = req.headers["x-hub-signature-256"] as string;
  const timestamp = req.headers["x-hub-signature-256-timestamp"] as string;

  // Validate required headers
  if (!signature) {
    throw new MissingSignatureError({
      path: req.originalUrl,
      method: req.method,
    });
  }

  if (!timestamp) {
    throw new MissingSignatureError({
      path: req.originalUrl,
      method: req.method,
      missingHeader: "X-Hub-Signature-256-Timestamp",
    });
  }

  // Get the raw body for signature verification
  const rawBody = req.body;
  if (!rawBody) {
    throw new InvalidWebhookPayloadError("Missing request body", {
      path: req.originalUrl,
      method: req.method,
    });
  }

  // Convert body to string if it's not already
  const payloadString =
    typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

  // Verify the webhook signature
  const verificationResult = await verifyWebhookSignature(
    payloadString,
    signature,
    timestamp
  );

  // Parse and validate the webhook payload
  let event;
  try {
    const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    event = parseGitHubWebhookEvent(payload);
  } catch (error) {
    logger.error({
      message: "Failed to parse webhook payload",
      error: error instanceof Error ? error.message : String(error),
      path: req.originalUrl,
      method: req.method,
    });
    throw new InvalidWebhookPayloadError("Invalid webhook payload", {
      path: req.originalUrl,
      method: req.method,
    });
  }

  // Process the webhook event
  const result = await processWebhookEvent(event);

  logger.info({
    message: "Webhook processed successfully",
    action: event.action,
    repository: event.repository.full_name,
    sender: event.sender.login,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(200).json({
    success: true,
    message: result.message,
    event: {
      action: event.action,
      repository: event.repository.full_name,
    },
  });
}

/**
 * Health check endpoint for webhooks
 */
async function healthCheck(_req: Request, res: Response) {
  res.status(200).json({
    status: "healthy",
    message: "Webhook endpoint is ready",
    timestamp: new Date().toISOString(),
  });
}

export default {
  handleWebhook: asyncErrorBoundary(handleWebhook),
  healthCheck: asyncErrorBoundary(healthCheck),
};
