import { StatusError } from "./status";

/**
 * Base class for webhook-related errors
 */
export class WebhookError extends StatusError {
  constructor(
    message: string,
    status: number = 401,
    context?: Record<string, any>
  ) {
    super(message, status, context);
    this.name = "WebhookError";
  }
}

/**
 * Error thrown when webhook signature is missing
 */
export class MissingSignatureError extends WebhookError {
  constructor(context?: Record<string, any>) {
    super("Missing webhook signature", 401, context);
    this.name = "MissingSignatureError";
  }
}

/**
 * Error thrown when webhook signature format is invalid
 */
export class InvalidSignatureFormatError extends WebhookError {
  constructor(signature: string, context?: Record<string, any>) {
    super("Invalid signature format", 401, {
      signature: signature.substring(0, 20) + "...", // Log partial signature for debugging
      ...context,
    });
    this.name = "InvalidSignatureFormatError";
  }
}

/**
 * Error thrown when webhook timestamp is too old or too new
 */
export class TimestampValidationError extends WebhookError {
  constructor(
    timestamp: number,
    now: number,
    timeDiff: number,
    context?: Record<string, any>
  ) {
    super("Webhook timestamp validation failed", 401, {
      timestamp,
      now,
      timeDiff,
      maxAllowedDiff: 300, // 5 minutes
      ...context,
    });
    this.name = "TimestampValidationError";
  }
}

/**
 * Error thrown when webhook signature verification fails
 */
export class SignatureVerificationError extends WebhookError {
  constructor(
    providedSignature: string,
    expectedSignature: string,
    context?: Record<string, any>
  ) {
    super("Webhook signature verification failed", 401, {
      providedSignature: providedSignature.substring(0, 8) + "...",
      expectedSignature: expectedSignature.substring(0, 8) + "...",
      ...context,
    });
    this.name = "SignatureVerificationError";
  }
}

/**
 * Error thrown when webhook payload is invalid
 */
export class InvalidWebhookPayloadError extends WebhookError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, context);
    this.name = "InvalidWebhookPayloadError";
  }
}
