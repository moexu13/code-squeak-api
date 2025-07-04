import { Router } from "express";
import webhooksController from "./webhooks.controller";
import { timeout, TIMEOUTS } from "../../middleware/timeout";

const router = Router();

// Webhook endpoint for GitHub events with 30-second timeout
router.post(
  "/github",
  timeout(TIMEOUTS.LONG),
  webhooksController.handleWebhook
);

// Health check endpoint
router.get("/health", webhooksController.healthCheck);

export default router;
