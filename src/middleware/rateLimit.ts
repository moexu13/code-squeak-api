import { Request, Response, NextFunction } from "express";
import { githubRateLimiter } from "../utils/rateLimiter";
import { StatusError } from "../errors/status";
import logger from "../utils/logger";

export const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Use the API key as the rate limit key
    const key = req.headers["authorization"]?.split(" ").at(1) || "anonymous";
    const { remaining, reset } = await githubRateLimiter.checkLimit(key);

    // Add rate limit headers to the response
    res.setHeader("X-RateLimit-Limit", "5000");
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", reset.toString());

    if (remaining <= 0) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      res.setHeader("Retry-After", retryAfter.toString());

      logger.warn({
        message: "Rate limit exceeded",
        key,
        reset,
      });

      throw new StatusError("Rate limit exceeded", 429, {
        retryAfter,
        reset,
      });
    }

    next();
  } catch (error) {
    if (error instanceof StatusError) {
      throw error;
    }
    // If there's an error with the rate limiter, allow the request to proceed
    logger.error({
      message: "Rate limiter middleware error",
      error: error instanceof Error ? error : new Error(String(error)),
    });
    next();
  }
};
