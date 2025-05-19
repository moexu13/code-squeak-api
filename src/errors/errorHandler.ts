/**
 * Express API error handler.
 */
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { createSanitizedError } from "../utils/errorUtils";

interface ErrorResponse {
  error: string;
  status?: number;
  stack?: string;
}

function errorHandler(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const sanitizedError = createSanitizedError(err, req);

  // Log the full error details for debugging
  logger.error({
    msg: "Express error occurred",
    error: sanitizedError,
  });

  const status = err.status || 500;

  // Return a sanitized response to the client
  const response: ErrorResponse = {
    error: "Something went wrong",
    status,
  };

  res.status(status).json(response);
}

export default errorHandler;
