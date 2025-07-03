import { Router } from "express";
import webhooksController from "./webhooks.controller";

const router = Router();

// Webhook endpoint for GitHub events
router.post("/github", webhooksController.handleWebhook);

// Health check endpoint
router.get("/health", webhooksController.healthCheck);

export default router;
