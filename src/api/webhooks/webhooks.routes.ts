import { Router } from "express";
import webhooksController from "./webhooks.controller";
import { timeout, TIMEOUTS } from "../../middleware/timeout";
import { payloadLimit, PAYLOAD_LIMITS } from "../../middleware/payloadLimit";

const router = Router();

// Webhook endpoint for GitHub events with timeout and payload limits
router.post(
  "/github",
  payloadLimit(
    PAYLOAD_LIMITS.MEDIUM,
    "Webhook payload too large. GitHub webhooks should be under 100KB"
  ),
  timeout(TIMEOUTS.LONG),
  webhooksController.handleWebhook
);

// Health check endpoint
router.get("/health", webhooksController.healthCheck);

export default router;
