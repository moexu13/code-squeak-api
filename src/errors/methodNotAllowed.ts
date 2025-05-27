import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { MethodNotAllowedError } from "./http";
/**
 * Express middleware to handle method not allowed errors
 */
function methodNotAllowed(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error = new MethodNotAllowedError(
    `${req.method} not allowed for ${req.originalUrl}`,
    {
      url: req.originalUrl,
      method: req.method,
    }
  );

  logger.error({
    msg: "Method not allowed",
    error: error.message,
    context: error.context,
  });

  next(error);
}

export default methodNotAllowed;
