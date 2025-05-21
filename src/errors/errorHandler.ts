/**
 * Express API error handler.
 */
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { config } from "../config/env";

export default function errorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error
  logger.error({
    message: "Express error occurred",
    error: err,
  });

  // Only report to Sentry if not in test environment
  if (!config.env.isTest) {
    import("@sentry/node").then((Sentry) => {
      Sentry.captureException(err);
    });
  }

  // Get status code from error or default to 500
  const status = err.status || 500;

  // Handle errors
  res.status(status).json({
    error: "Something went wrong",
    message: config.env.isDevelopment ? err.message : undefined,
  });
}
