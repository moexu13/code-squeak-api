import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import logger from "../utils/logger";

/**
 * Express API "Not found" handler.
 * This middleware should be placed after all valid routes.
 */
function notFound(req: Request, _res: Response, next: NextFunction): void {
  logger.error({
    msg: "Not found",
    error: `${req.originalUrl}`,
  });
  next(createError(404, `Not found: ${req.originalUrl}`));
}

export default notFound;
