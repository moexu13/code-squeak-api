import { Request, Response, NextFunction } from "express";
import { NotFoundError, MethodNotAllowedError } from "./http";

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

/**
 * Class to handle 405 Method Not Allowed errors
 */
export class MethodNotAllowedHandler {
  /**
   * Middleware to handle 405 Method Not Allowed errors
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next function
   */
  static handle(req: Request, _res: Response, next: NextFunction) {
    const error = new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`,
      {
        url: req.originalUrl,
        method: req.method,
      }
    );
    next(error);
  }
}
