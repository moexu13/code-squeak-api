import { Request, Response, NextFunction } from "express";

/**
 * Creates a timeout middleware that will abort requests that take too long
 * @param ms - Timeout duration in milliseconds
 * @param message - Optional custom timeout message
 * @returns Express middleware function
 */
export const timeout = (ms: number, message?: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeoutMessage =
      message || `Request processing took longer than ${ms}ms`;

    const timer = setTimeout(() => {
      // Only send response if it hasn't been sent yet
      if (!res.headersSent) {
        res.status(408).json({
          error: "Request timeout",
          message: timeoutMessage,
          timeout: ms,
        });
      }
    }, ms);

    // Clear the timeout when the response finishes
    res.on("finish", () => {
      clearTimeout(timer);
    });

    // Clear the timeout when the response is sent
    res.on("close", () => {
      clearTimeout(timer);
    });

    next();
  };
};

/**
 * Predefined timeout durations for common use cases
 */
export const TIMEOUTS = {
  SHORT: 5000, // 5 seconds - for simple operations
  MEDIUM: 15000, // 15 seconds - for moderate processing
  LONG: 30000, // 30 seconds - for webhooks and complex operations
  VERY_LONG: 60000, // 60 seconds - for very heavy operations
} as const;
