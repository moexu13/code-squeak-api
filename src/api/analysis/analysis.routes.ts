import { Router } from "express";
import controller from "./analysis.controller";
import { MethodNotAllowedError } from "../../errors/http";
import { payloadLimit, PAYLOAD_LIMITS } from "../../middleware/payloadLimit";

const router = Router();

const methodNotAllowed = (req: any, _res: any, next: any) => {
  next(
    new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`
    )
  );
};

// Create an analysis
router.post(
  "/",
  payloadLimit(
    PAYLOAD_LIMITS.LARGE,
    "Analysis payload too large. Maximum size is 1MB for code diffs"
  ),
  controller.create
);

// Analyze a pull request
router.post(
  "/pr",
  payloadLimit(
    PAYLOAD_LIMITS.SMALL,
    "PR analysis payload too large. Maximum size is 10KB for PR parameters"
  ),
  controller.analyzePR
);

// Handle unsupported methods
router.all("/", methodNotAllowed);
router.all("/pr", methodNotAllowed);

export default router;
