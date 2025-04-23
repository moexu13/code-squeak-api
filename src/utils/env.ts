import logger from "./logger";

interface RequiredEnv {
  GITHUB_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  REDIS_URL: string;
  LOG_LEVEL?: string;
}

function validateRedisUrl(url: string): void {
  // First check the protocol
  if (!url.startsWith("redis://") && !url.startsWith("rediss://")) {
    throw new Error("Redis URL must start with redis:// or rediss://");
  }

  try {
    // Handle localhost and IP addresses with optional port
    const localhostMatch = url.match(/^redis:\/\/(localhost|127\.0\.0\.1)(:(\d+))?(\/.*)?$/);
    if (localhostMatch) {
      // If port is present, validate it
      if (localhostMatch[3]) {
        const port = parseInt(localhostMatch[3], 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error("Redis URL has invalid port number");
        }
      }
      return;
    }

    // For other URLs, validate the full URL structure
    const parsedUrl = new URL(url);

    // Check for hostname
    if (!parsedUrl.hostname) {
      throw new Error("Redis URL must have a hostname");
    }

    // Check for valid port if present
    if (parsedUrl.port) {
      const port = parseInt(parsedUrl.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new Error("Redis URL has invalid port number");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid Redis URL: ${error.message}`);
    }
    throw new Error("Invalid Redis URL: Unknown error");
  }
}

export function validateEnv(required: RequiredEnv): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  // Check for missing variables
  Object.entries(required).forEach(([key, value]) => {
    if (!value) {
      missing.push(key);
    }
  });

  // Validate GitHub token length
  if (required.GITHUB_TOKEN && required.GITHUB_TOKEN.length < 40) {
    invalid.push("GITHUB_TOKEN (must be at least 40 characters)");
  }

  // Validate Redis URL
  if (required.REDIS_URL) {
    try {
      validateRedisUrl(required.REDIS_URL);
    } catch (error) {
      if (error instanceof Error) {
        invalid.push(`REDIS_URL (${error.message})`);
      }
    }
  }

  // Log validation results
  if (missing.length > 0) {
    logger.error({ missingVariables: missing }, "Missing required environment variables");
  }

  if (invalid.length > 0) {
    logger.error({ invalidVariables: invalid }, "Invalid environment variables");
  }

  // Throw error if validation fails
  if (missing.length > 0 || invalid.length > 0) {
    throw new Error(
      `Environment validation failed:\nMissing: ${missing.join(", ")}\nInvalid: ${invalid.join(", ")}`
    );
  }

  logger.info({ context: "Environment" }, "Environment variables validated successfully");
}
