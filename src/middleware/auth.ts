import { Request, Response, NextFunction, RequestHandler } from "express";
import { Unkey } from "@unkey/api";
import logger from "../utils/logger";
import { config } from "../config/env";
import { UnauthorizedError } from "../errors/http";

// Only check for environment variables in production
if (!config.env.isTest) {
  if (!config.unkey.rootKey) {
    throw new Error("UNKEY_ROOT_KEY environment variable is required");
  }

  if (!config.unkey.apiId) {
    throw new Error("UNKEY_API_ID environment variable is required");
  }
}

const unkey = new Unkey({
  rootKey: config.unkey.rootKey || "test-key",
});

const authMiddleware = (async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  logger.info({
    message: "Auth middleware processing request",
    url: req.originalUrl,
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
  });

  const key = req.headers["authorization"]?.split(" ").at(1);
  if (!key) {
    if (!config.env.isTest) {
      logger.error({
        message: "Unauthorized: Missing API key",
        path: req.originalUrl,
        method: req.method,
      });
    }
    throw new UnauthorizedError("Missing API key", {
      path: req.originalUrl,
      method: req.method,
    });
  }

  // In development mode, accept a test key for easier testing
  if (config.env.isDevelopment && key === "valid-key") {
    logger.info({
      message: "Development mode: accepting test key",
      path: req.originalUrl,
      method: req.method,
    });
    return next();
  }

  const { result, error } = await unkey.keys.verify({
    apiId: config.unkey.apiId || "test-api-id",
    key,
  });

  logger.info({
    message: "Auth verification result",
    valid: result?.valid,
    error: error ? "present" : "none",
    path: req.originalUrl,
    method: req.method,
  });

  if (error || !result.valid) {
    if (!config.env.isTest) {
      logger.error({
        message: "Unauthorized: Invalid API key",
        error,
        path: req.originalUrl,
        method: req.method,
      });
    }
    throw new UnauthorizedError("Invalid API key", {
      path: req.originalUrl,
      method: req.method,
      error,
    });
  }

  logger.info({
    message: "Auth middleware passed request through",
    url: req.originalUrl,
    method: req.method,
  });
  logger.info({
    message: "About to call next() in auth middleware",
    url: req.originalUrl,
    method: req.method,
  });

  // Add a callback to see if next() completes
  const originalNext = next;
  next = (err?: any) => {
    logger.info({
      message: "next() callback executed in auth middleware",
      url: req.originalUrl,
      method: req.method,
      hasError: !!err,
    });
    return originalNext(err);
  };

  return next();
}) as unknown as RequestHandler;

export default authMiddleware;
