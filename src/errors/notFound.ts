import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { NotFoundError } from "./http";

/**
 * Express API "Not found" handler.
 * This middleware should be placed after all valid routes.
 */
function notFound(req: Request, _res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Not found: ${req.originalUrl}`, {
    url: req.originalUrl,
    method: req.method,
  });

  logger.error({
    msg: "Not found",
    error: error.message,
    context: error.context,
  });

  next(error);
}

export default notFound;
