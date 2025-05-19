import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import logger from "../utils/logger";
import { createSanitizedError } from "../utils/errorUtils";
/**
 * Express middleware to handle method not allowed errors
 */
function methodNotAllowed(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error = createError(
    405,
    `${req.method} not allowed for ${req.originalUrl}`
  );
  logger.error({
    msg: "Method not allowed",
    error: createSanitizedError(error, req),
  });
  next(error);
}

export default methodNotAllowed;
