/**
 * Express API error handler.
 */
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { config } from "../config/env";
import { HttpError, InternalServerError } from "./http";
import { StatusError } from "./status";

interface ErrorWithStatus extends Error {
  status?: number;
  context?: Record<string, unknown>;
}

interface ErrorContext {
  originalError?: Error;
  stack?: string;
}

function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Convert unknown errors to InternalServerError
  const error: ErrorWithStatus =
    err instanceof HttpError ||
    err instanceof StatusError ||
    (err as ErrorWithStatus).status
      ? err
      : new InternalServerError(err.message, {
          originalError: err,
          stack: err.stack,
        });

  // Log the error with context
  logger.error({
    message: "Express error occurred",
    error: {
      message: error.message,
      name:
        error instanceof InternalServerError
          ? (error.context as ErrorContext)?.originalError?.name || "Error"
          : error.name,
      ...(error instanceof StatusError || error.status
        ? { status: error.status }
        : {}),
      ...(error instanceof InternalServerError &&
      (error.context as ErrorContext)?.stack
        ? { stack: (error.context as ErrorContext).stack }
        : {}),
    },
  });

  // Only report to Sentry in production
  if (config.env.isProduction) {
    import("@sentry/node").then((Sentry) => {
      Sentry.captureException(error, {
        extra:
          error instanceof StatusError || error.status
            ? { status: error.status }
            : error.context,
      });
    });
  }

  // Send response with appropriate status code
  const status =
    error instanceof StatusError || error.status ? error.status || 500 : 500;
  res.status(status).json({
    error: "Something went wrong",
    message: config.env.isDevelopment ? error.message : undefined,
  });
}

export default errorHandler;
