import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { config } from "../config/env";
import { HttpErrorInterface } from "./types";
import { sanitizeErrorMessage } from "./utils";

type AsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Class to handle async errors in Express middleware
 */
export class AsyncErrorBoundary {
  /**
   * Wraps an async function to handle errors and pass them to Express error handling middleware
   * @param fn - The async function to wrap
   * @returns Express middleware function
   */
  static wrap(fn: AsyncFunction) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fn(req, res, next);
      } catch (error: unknown) {
        // Only log errors in non-test environments
        if (!config.env.isTest) {
          logger.error({
            message: "Async operation failed",
            error: {
              message: sanitizeErrorMessage(
                error instanceof Error ? error.message : String(error)
              ),
              name: error instanceof Error ? error.name : "Error",
              ...(error instanceof Error && error.stack
                ? { stack: error.stack }
                : {}),
              ...(error as HttpErrorInterface).context,
            },
          });
        }

        next(error);
      }
    };
  }
}

// For backward compatibility
export default AsyncErrorBoundary.wrap;
