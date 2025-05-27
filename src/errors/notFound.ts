import { Request, Response, NextFunction } from "express";
import { NotFoundError } from "./http";

/**
 * Class to handle 404 Not Found errors
 */
export class NotFoundHandler {
  /**
   * Middleware to handle 404 Not Found errors
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   */
  static handle(req: Request, _res: Response, next: NextFunction) {
    const error = new NotFoundError(`Not found: ${req.originalUrl}`, {
      url: req.originalUrl,
      method: req.method,
    });
    next(error);
  }
}

// For backward compatibility
export default NotFoundHandler.handle;
