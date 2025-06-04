import { Router } from "express";
import controller from "./claude.controller";
import { MethodNotAllowedError } from "../../errors/http";

const router = Router();

const methodNotAllowed = (req: any, _res: any, next: any) => {
  next(
    new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`
    )
  );
};

// Create a completion
router.post("/completion", controller.create);

// Handle unsupported methods
router.all("/completion", methodNotAllowed);

export default router;
