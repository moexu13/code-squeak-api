/**
 * Express API error handler.
 */
import { Request, Response, NextFunction } from "express";

interface ErrorResponse {
  error: string;
  status?: number;
  stack?: string;
}

function errorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(err);

  const status = err.status || 500;
  const message = err.message || "Something went wrong!";

  const response: ErrorResponse = {
    error: message,
    status,
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(status).json(response);
}

export default errorHandler;
