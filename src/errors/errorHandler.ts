/**
 * Express API error handler.
 */
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { config } from "../config/env";
import { HttpError, InternalServerError } from "./http";
import { StatusError } from "./status";
import { HttpErrorInterface, ErrorContext } from "./types";

// Helper to check if an error has a status property
function hasStatus(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error;
}

/**
 * Class to handle errors in Express middleware
 */
export class ErrorHandler {
  /**
   * Middleware to handle errors
   * @param err - The error to handle
   * @param _req - Express request object
   * @param res - Express response object
   * @param _next - Express next function
   */
  static handle(err: Error, _req: Request, res: Response, _next: NextFunction) {
    // Convert unknown errors to InternalServerError
    const error: HttpErrorInterface =
      err instanceof HttpError || err instanceof StatusError || hasStatus(err)
        ? err
        : new InternalServerError(err.message, {
            originalError: err,
            stack: err.stack,
          });

    // Log the error with context
    // Note: We log in test mode for specific test cases that verify error handling
    logger.error({
      message: "Express error occurred",
      error: {
        message: error.message,
        name:
          error instanceof StatusError
            ? error.name
            : error instanceof InternalServerError
            ? (error.context as ErrorContext)?.originalError?.name || "Error"
            : error.name,
        status: hasStatus(error) ? error.status : 500,
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
          extra: error.context,
        });
      });
    }

    // Send response with appropriate status code
    res.status(hasStatus(error) ? error.status : 500).json({
      error: "Something went wrong",
      message: config.env.isDevelopment ? error.message : undefined,
    });
  }
}

// For backward compatibility
export default ErrorHandler.handle;
