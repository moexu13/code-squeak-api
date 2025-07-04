import { Request, Response, NextFunction } from "express";

/**
 * Creates a payload size limit middleware
 * @param maxSize - Maximum payload size in bytes
 * @param message - Optional custom error message
 * @returns Express middleware function
 */
export const payloadLimit = (maxSize: number, message?: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);

    if (contentLength > maxSize) {
      const errorMessage =
        message || `Payload too large. Maximum size is ${formatBytes(maxSize)}`;

      res.status(413).json({
        error: "Payload too large",
        message: errorMessage,
        maxSize: formatBytes(maxSize),
        receivedSize: formatBytes(contentLength),
      });
      return;
    }

    next();
  };
};

/**
 * Predefined payload size limits for common use cases
 */
export const PAYLOAD_LIMITS = {
  TINY: 1024, // 1KB - for simple API calls
  SMALL: 10240, // 10KB - for moderate data
  MEDIUM: 102400, // 100KB - for webhooks and moderate payloads
  LARGE: 1048576, // 1MB - for large webhooks (default)
  VERY_LARGE: 5242880, // 5MB - for very large payloads
} as const;

/**
 * Format bytes into human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Middleware to log payload sizes for monitoring
 */
export const payloadLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);

  if (contentLength > 0) {
    console.log(
      `[PAYLOAD] ${req.method} ${req.path} - ${formatBytes(contentLength)}`
    );
  }

  next();
};
