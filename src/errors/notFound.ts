import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { NotFoundError } from "./http";

/**
 * Class to handle not found errors in Express middleware
 */
export class NotFoundHandler {
  /**
   * Middleware to handle not found errors
   * @param req - Express request object
   * @param _res - Express response object
   * @param next - Express next function
   */
  static handle(req: Request, _res: Response, next: NextFunction): void {
    const error = new NotFoundError(`Not found: ${req.originalUrl}`, {
      url: req.originalUrl,
      method: req.method,
    });

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
export default NotFoundHandler.handle;
