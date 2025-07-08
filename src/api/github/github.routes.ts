import { Router } from "express";
import controller from "./github.controller";
import { MethodNotAllowedError } from "../../errors/http";
import { rateLimitMiddleware } from "../../middleware/rateLimit";
import { payloadLimit, PAYLOAD_LIMITS } from "../../middleware/payloadLimit";

const router = Router();

const methodNotAllowed = (req: any, _res: any, next: any) => {
  next(
    new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`
    )
  );
};

// Apply rate limiting to all GitHub routes
router.use(rateLimitMiddleware);

// List repositories for a user
router.get("/:owner", controller.list);

// Get pull requests for a repository
router.get("/:owner/:repo", controller.read);

// Create a comment on a pull request
router.post(
  "/:owner/:repo/:pull_number/comments",
  payloadLimit(
    PAYLOAD_LIMITS.MEDIUM,
    "Comment payload too large. Maximum size is 100KB for pull request comments"
  ),
  controller.create
);

// Get diff for a pull request
router.get("/:owner/:repo/:pull_number/diff", controller.getDiff);

// Handle unsupported methods
router.all("/:owner", methodNotAllowed);
router.all("/:owner/:repo", methodNotAllowed);
router.all("/:owner/:repo/:pull_number/comments", methodNotAllowed);
router.all("/:owner/:repo/:pull_number/diff", methodNotAllowed);

export default router;
