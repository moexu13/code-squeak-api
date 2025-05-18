import { Request, Response, NextFunction } from "express";
import createError from "http-errors";

/**
 * Express middleware to handle method not allowed errors
 */
function methodNotAllowed(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  next(createError(405, `${req.method} not allowed for ${req.originalUrl}`));
}

export default methodNotAllowed;
