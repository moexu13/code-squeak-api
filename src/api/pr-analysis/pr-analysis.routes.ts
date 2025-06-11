import express from "express";
import controller from "./pr-analysis.controller";
import { MethodNotAllowedError } from "../../errors/http";

const router = express.Router();

// Analyze a pull request and post the analysis as a comment
router.post("/:owner/:repo/:pull_number", controller.create);

// Block all other methods
router.all("/:owner/:repo/:pull_number", (req, _res, next) => {
  next(
    new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`
    )
  );
});

export default router;
