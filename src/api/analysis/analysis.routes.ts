import { Router } from "express";
import controller from "./analysis.controller";
import { MethodNotAllowedError } from "../../errors/http";
import logger from "../../utils/logger";

const router = Router();

// Add logging to see if router is being used
router.use((req, _res, next) => {
  logger.info({
    message: "Analysis router middleware reached",
    url: req.originalUrl,
    method: req.method,
    path: req.path,
  });
  next();
});

// Add a test route to see if router is working
router.get("/test", (req, res) => {
  logger.info({
    message: "Analysis router test route reached",
    url: req.originalUrl,
    method: req.method,
  });
  res.json({ message: "Analysis router is working" });
});

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
router.post("/pr", (req, res, next) => {
  logger.info({
    message: "Analysis router /pr route matched",
    url: req.originalUrl,
    method: req.method,
  });
  controller.analyzePR(req, res, next);
});

// Handle unsupported methods
router.all("/", methodNotAllowed);
router.all("/pr", methodNotAllowed);

export default router;
