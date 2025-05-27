import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { config } from "../config/env";
import { HttpErrorInterface } from "./types";

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
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    ...(error as HttpErrorInterface).context,
                  }
                : error,
          });
        }

        next(error);
      }
    };
  }
}

// For backward compatibility
export default AsyncErrorBoundary.wrap;
