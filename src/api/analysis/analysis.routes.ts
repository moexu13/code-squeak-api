import { Router } from "express";
import controller from "./analysis.controller";
import { MethodNotAllowedError } from "../../errors/http";

const router = Router();

const methodNotAllowed = (req: any, _res: any, next: any) => {
  next(
    new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`
    )
  );
};

// Create an analysis
router.post("/", controller.create);

// Analyze a pull request
router.post("/pr", controller.analyzePR);

// Handle unsupported methods
router.all("/", methodNotAllowed);
router.all("/pr", methodNotAllowed);

export default router;
