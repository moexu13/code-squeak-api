/**
 * Express API error handler.
 */
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { config } from "../config/env";
import { createSanitizedError } from "../utils/errorUtils";

function errorHandler(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Create sanitized error object
  const sanitizedError = createSanitizedError(err, req);

  // Log the sanitized error
  logger.error({
    message: "Express error occurred",
    error: sanitizedError,
  });

  // Only report to Sentry in production
  if (config.env.isProduction) {
    import("@sentry/node").then((Sentry) => {
      Sentry.captureException(err, {
        extra: {
          request: sanitizedError.request,
        },
      });
    });
  }

  // Get status code from error or default to 500
  const status = err.status || 500;

  // Handle errors
  res.status(status).json({
    error: "Something went wrong",
    message: config.env.isDevelopment ? sanitizedError.message : undefined,
  });
}

export default errorHandler;
