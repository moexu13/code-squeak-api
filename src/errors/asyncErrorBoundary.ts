import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { createSanitizedError } from "../utils/errorUtils";

type AsyncFunction = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

/**
 * Wraps an async function to handle errors and pass them to Express error handling middleware
 * @param fn - The async function to wrap
 * @returns Express middleware function
 */
function asyncErrorBoundary(fn: AsyncFunction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error: unknown) {
      // Log the sanitized error
      logger.error({
        msg: "Async operation failed",
        error: createSanitizedError(error, req),
      });

      next(error);
    }
  };
}

export default asyncErrorBoundary;
