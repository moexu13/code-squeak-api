import { Request, Response, NextFunction, RequestHandler } from "express";
import { Unkey } from "@unkey/api";
import logger from "../utils/logger";
import { config } from "../config/env";

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
  res: Response,
  next: NextFunction
) => {
  const key = req.headers["authorization"]?.split(" ").at(1);
  if (!key) {
    logger.error({
      msg: "Unauthorized: Missing API key",
      path: req.originalUrl,
      method: req.method,
    });
    return res.status(401).send("Unauthorized");
  }

  const { result, error } = await unkey.keys.verify({
    apiId: config.unkey.apiId || "test-api-id",
    key,
  });
  if (error || !result.valid) {
    logger.error({
      msg: "Unauthorized: Invalid API key",
      error,
      path: req.originalUrl,
      method: req.method,
    });
    return res.status(401).send("Unauthorized");
  }

  return next();
}) as unknown as RequestHandler;

export default authMiddleware;
