import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { MethodNotAllowedError } from "./http";

/**
 * Class to handle method not allowed errors in Express middleware
 */
export class MethodNotAllowedHandler {
  /**
   * Middleware to handle method not allowed errors
   * @param req - Express request object
   * @param _res - Express response object
   * @param next - Express next function
   */
  static handle(req: Request, _res: Response, next: NextFunction): void {
    const error = new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`,
      {
        url: req.originalUrl,
        method: req.method,
      }
    );

    logger.error({
      message: "Express error occurred",
      error: {
        name: error.name,
        message: error.message,
        ...error.context,
      },
    });

    next(error);
  }
}

// For backward compatibility
export default MethodNotAllowedHandler.handle;
